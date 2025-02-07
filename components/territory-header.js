import { Badge, Button, CardFooter, Dropdown } from 'react-bootstrap'
import { AccordianCard } from './accordian-item'
import TerritoryPaymentDue, { TerritoryBillingLine } from './territory-payment-due'
import Link from 'next/link'
import Text from './text'
import { numWithUnits } from '@/lib/format'
import styles from './item.module.css'
import Badges from './badge'
import { useMe } from './me'
import Share from './share'
import { gql, useMutation } from '@apollo/client'
import { useToast } from './toast'
import ActionDropdown from './action-dropdown'
import { TerritoryTransferDropdownItem } from './territory-transfer'

export function TerritoryDetails ({ sub, children }) {
  return (
    <AccordianCard
      header={
        <small className='text-muted fw-bold align-items-center d-flex'>
          {sub.name}
          {sub.status === 'STOPPED' && <Badge className='ms-2' bg='danger'>archived</Badge>}
          {(sub.moderated || sub.moderatedCount > 0) && <Badge className='ms-2' bg='secondary'>moderated{sub.moderatedCount > 0 && ` ${sub.moderatedCount}`}</Badge>}
          {(sub.nsfw) && <Badge className='ms-2' bg='secondary'>nsfw</Badge>}
        </small>
      }
    >
      {children}
      <TerritoryInfo sub={sub} />
    </AccordianCard>
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

export function TerritoryInfo ({ sub }) {
  return (
    <>
      <div className='py-2'>
        <Text>{sub.desc}</Text>
      </div>
      <CardFooter className={`py-1 ${styles.other}`}>
        <div className='text-muted'>
          <span>founded by </span>
          <Link href={`/${sub.user.name}`}>
            @{sub.user.name}<Badges badgeClassName='fill-grey' height={12} width={12} user={sub.user} />
          </Link>
          <span> on </span>
          <span className='fw-bold'>{new Date(sub.createdAt).toDateString()}</span>
        </div>
        <div className='d-flex'>
          <div className='text-muted'>
            <span>post cost </span>
            <span className='fw-bold'>{numWithUnits(sub.baseCost)}</span>
          </div>
          <span className='px-1'> \ </span>
          <div className='text-muted'>
            <span>reply cost </span>
            <span className='fw-bold'>{numWithUnits(sub.replyCost)}</span>
          </div>
        </div>
        <TerritoryBillingLine sub={sub} />
      </CardFooter>
    </>
  )
}

export default function TerritoryHeader ({ sub }) {
  const { me } = useMe()
  const toaster = useToast()

  const [toggleMuteSub] = useMutation(
    gql`
      mutation toggleMuteSub($name: String!) {
        toggleMuteSub(name: $name)
      }`, {
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

  const isMine = Number(sub.userId) === Number(me?.id)

  return (
    <>
      <TerritoryPaymentDue sub={sub} />
      <div className='mb-2 mt-1'>
        <div>
          <TerritoryDetails sub={sub}>
            <div className='d-flex my-2 justify-content-end'>
              {sub.name}
              <Share path={`/~${sub.name}`} title={`~${sub.name} stacker news territory`} className='mx-1' />
              {me &&
                <>
                  {(isMine
                    ? (
                      <Link href={`/~${sub.name}/edit`} className='d-flex align-items-center'>
                        <Button variant='outline-grey border-2 rounded py-0' size='sm'>edit territory</Button>
                      </Link>)
                    : (
                      <Button
                        variant='outline-grey border-2 py-0 rounded'
                        size='sm'
                        onClick={async () => {
                          try {
                            await toggleMuteSub({ variables: { name: sub.name } })
                          } catch {
                            toaster.danger(`failed to ${sub.meMuteSub ? 'join' : 'mute'} territory`)
                            return
                          }
                          toaster.success(`${sub.meMuteSub ? 'joined' : 'muted'} territory`)
                        }}
                      >{sub.meMuteSub ? 'join' : 'mute'} territory
                      </Button>)
              )}
                  <ActionDropdown>
                    <ToggleSubSubscriptionDropdownItem sub={sub} />
                    {isMine && (
                      <>
                        <Dropdown.Divider />
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

export function MuteSubDropdownItem ({ item, sub }) {
  const toaster = useToast()

  const [toggleMuteSub] = useMutation(
    gql`
      mutation toggleMuteSub($name: String!) {
        toggleMuteSub(name: $name)
      }`, {
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
    <Dropdown.Item
      onClick={async () => {
        try {
          await toggleMuteSub({ variables: { name: sub.name } })
        } catch {
          toaster.danger(`failed to ${sub.meMuteSub ? 'join' : 'mute'} territory`)
          return
        }
        toaster.success(`${sub.meMuteSub ? 'joined' : 'muted'} territory`)
      }}
    >{sub.meMuteSub ? 'unmute' : 'mute'} ~{sub.name}
    </Dropdown.Item>
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
    <Dropdown.Item
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
    </Dropdown.Item>
  )
}

export function ToggleSubSubscriptionDropdownItem ({ sub: { name, meSubscription } }) {
  const toaster = useToast()
  const [toggleSubSubscription] = useMutation(
    gql`
      mutation toggleSubSubscription($name: String!) {
        toggleSubSubscription(name: $name)
      }`, {
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
    <Dropdown.Item
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
    </Dropdown.Item>
  )
}
