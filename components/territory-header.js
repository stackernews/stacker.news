import { createContext, useContext } from 'react'
import { MenuItem, MenuSeparator } from '@/components/ui/menu'
import Badge from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { AccordionCard } from './accordion-item'
import TerritoryPaymentDue, { TerritoryBillingLine } from './territory-payment-due'
import Link from 'next/link'
import Text from '@/components/text'
import { numWithUnits } from '@/lib/format'
import styles from './item.module.css'
import Badges from './badge'
import { useMe } from './me'
import Share from './share'
import { gql } from '@apollo/client'
import { useMutation } from '@apollo/client/react'
import { useToast } from '@/components/ui/toast'
import ActionDropdown from './action-dropdown'
import { TerritoryTransferDropdownItem } from './territory-transfer'
import { usePrefix } from './territory-domains'

const SubscribeTerritoryContext = createContext({ refetchQueries: [] })

export const SubscribeTerritoryContextProvider = ({ children, value }) => (
  <SubscribeTerritoryContext.Provider value={value}>
    {children}
  </SubscribeTerritoryContext.Provider>
)

export const useSubscribeTerritoryContext = () => useContext(SubscribeTerritoryContext)

export function TerritoryDetails ({ sub, children, className, show, truncated }) {
  return (
    <AccordionCard
      className={className}
      show={show}
      header={
        <small className='text-muted font-bold items-center flex min-w-0 flex-wrap gap-y-1'>
          <span className='min-w-0 wrap-break-word'>{sub.name}</span>
          {sub.status === 'STOPPED' && <Badge variant='danger' className='ms-2'>archived</Badge>}
          {(sub.nsfw) && <Badge variant='secondary' className='ms-2'>nsfw</Badge>}
        </small>
      }
    >
      {children}
      <TerritoryInfo sub={sub} truncated={truncated} />
    </AccordionCard>
  )
}

export function TerritoryInfoSkeleton ({ children, className }) {
  return (
    <div className={`${styles.item} ${styles.skeleton} ${className}`}>
      <div className={styles.hunk}>
        <div className={`${styles.name} clouds text-reset`} />
        {children}
      </div>
    </div>
  )
}

export function TerritoryInfo ({ sub, includeLink, truncated }) {
  return (
    <>
      {includeLink && <Link className='font-bold' href={`/~${sub.name}`}>~{sub.name}</Link>}
      <div className='py-2 empty:hidden'>
        <Text state={sub.lexicalState} html={sub.html}>{truncated ? sub.desc : undefined}</Text>
      </div>
      <div className={`py-1 ${styles.other}`}>
        {sub.user &&
          <div className='text-muted'>
            <span>founded by </span>
            <Link href={`/${sub.user.name}`}>
              @{sub.user.name}<Badges badgeClassName='fill-muted' height={12} width={12} user={sub.user} />
            </Link>
            <span> on </span>
            <span className='font-bold' suppressHydrationWarning>{new Date(sub.createdAt).toDateString()}</span>
          </div>}
        <div className='flex flex-wrap'>
          <div className='text-muted'>
            <span>post cost </span>
            <span className='font-bold'>{numWithUnits(sub.baseCost)}</span>
          </div>
          <span className='px-1'> \ </span>
          <div className='text-muted'>
            <span>reply cost </span>
            <span className='font-bold'>{numWithUnits(sub.replyCost)}</span>
          </div>
        </div>
        {/* TODO: Show custom domain if it exists */}
        <TerritoryBillingLine sub={sub} />
      </div>
    </>
  )
}

export default function TerritoryHeader ({ sub, show = false, menuPositionMethod }) {
  const { me } = useMe()
  const prefix = usePrefix(sub.name)

  const isMine = Number(sub.userId) === Number(me?.id)

  return (
    <>
      <TerritoryPaymentDue sub={sub} />
      <div className='mb-2 mt-1'>
        <div>
          <TerritoryDetails sub={sub} show={show}>
            <div className='flex flex-wrap items-center gap-y-2 my-2 justify-end'>
              <span className='min-w-0 wrap-break-word'>{sub.name}</span>
              <Share path={`${prefix}/`} title={`~${sub.name} stacker news territory`} className='mx-1' />
              {me &&
                <>
                  {isMine && (
                    <Link href={`${prefix}/edit`} className={buttonClasses({ variant: 'outline-grey', size: 'sm', className: 'flex items-center border-2 rounded-md py-0' })}>
                      edit territory
                    </Link>
                  )}
                  <ActionDropdown positionMethod={menuPositionMethod}>
                    <ToggleSubSubscriptionDropdownItem sub={sub} />
                    {!isMine && (
                      <MuteSubDropdownItem sub={sub}>
                        {sub.meMuteSub ? 'join' : 'mute'} territory
                      </MuteSubDropdownItem>
                    )}
                    {isMine && (
                      <>
                        <MenuSeparator />
                        <TerritoryTransferDropdownItem sub={sub} />
                      </>
                    )}
                  </ActionDropdown>
                </>}
            </div>
          </TerritoryDetails>
        </div>
      </div>
    </>
  )
}

export function MuteSubDropdownItem ({ sub, children }) {
  const toaster = useToast()
  const { refetchQueries } = useSubscribeTerritoryContext()

  const [toggleMuteSub] = useMutation(
    gql`
      mutation toggleMuteSub($name: String!) {
        toggleMuteSub(name: $name)
      }`, {
      refetchQueries,
      awaitRefetchQueries: true,
      update (cache, { data: { toggleMuteSub } }) {
        cache.modify({
          id: `Sub:{"name":"${sub.name}"}`,
          fields: {
            meMuteSub: () => toggleMuteSub
          }
        })
      }
    }
  )

  return (
    <MenuItem
      onClick={async () => {
        try {
          await toggleMuteSub({ variables: { name: sub.name } })
        } catch {
          toaster.danger(`failed to ${sub.meMuteSub ? 'join' : 'mute'} territory`)
          return
        }
        toaster.success(`${sub.meMuteSub ? 'joined' : 'muted'} territory`)
      }}
    >
      {children ?? `${sub.meMuteSub ? 'unmute' : 'mute'} ~${sub.name}`}
    </MenuItem>
  )
}

export function PinSubDropdownItem ({ item: { id, position } }) {
  const toaster = useToast()
  const [pinItem] = useMutation(
    gql`
      mutation pinItem($id: ID!) {
        pinItem(id: $id) {
            position
        }
      }`, {
      // refetch since position of other items might also have changed to fill gaps
      refetchQueries: ['SubItems', 'Item']
    }
  )
  return (
    <MenuItem
      onClick={async () => {
        try {
          await pinItem({ variables: { id } })
          toaster.success(position ? 'pin removed' : 'pin added')
        } catch (err) {
          toaster.danger(err.message)
        }
      }}
    >
      {position ? 'unpin item' : 'pin item'}
    </MenuItem>
  )
}

export function ToggleSubSubscriptionDropdownItem ({ sub: { name, meSubscription } }) {
  const toaster = useToast()
  const { refetchQueries } = useSubscribeTerritoryContext()
  const [toggleSubSubscription] = useMutation(
    gql`
      mutation toggleSubSubscription($name: String!) {
        toggleSubSubscription(name: $name)
      }`, {
      refetchQueries,
      awaitRefetchQueries: true,
      update (cache, { data: { toggleSubSubscription } }) {
        cache.modify({
          id: `Sub:{"name":"${name}"}`,
          fields: {
            meSubscription: () => toggleSubSubscription
          }
        })
      }
    }
  )
  return (
    <MenuItem
      onClick={async () => {
        try {
          await toggleSubSubscription({ variables: { name } })
          toaster.success(meSubscription ? 'unsubscribed' : 'subscribed')
        } catch (err) {
          console.error(err)
          toaster.danger(meSubscription ? 'failed to unsubscribe' : 'failed to subscribe')
        }
      }}
    >
      {meSubscription ? `unsubscribe from ~${name}` : `subscribe to ~${name}`}
    </MenuItem>
  )
}
