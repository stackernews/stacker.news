import { Badge, Button, CardFooter, Dropdown } from 'react-bootstrap'
import { AccordianCard } from './accordian-item'
import TerritoryPaymentDue, { TerritoryBillingLine } from './territory-payment-due'
import Link from 'next/link'
import Text from './text'
import { numWithUnits } from '../lib/format'
import styles from './item.module.css'
import Hat from './hat'
import { useMe } from './me'
import Share from './share'
import { gql, useMutation } from '@apollo/client'
import { useToast } from './toast'

export function TerritoryDetails ({ sub }) {
  return (
    <AccordianCard
      header={
        <small className='text-muted fw-bold align-items-center d-flex'>
          territory details
          {sub.status === 'STOPPED' && <Badge className='ms-2' bg='danger'>archived</Badge>}
          {(sub.moderated || sub.moderatedCount > 0) && <Badge className='ms-2' bg='secondary'>moderated{sub.moderatedCount > 0 && ` ${sub.moderatedCount}`}</Badge>}
        </small>
      }
    >
      <TerritoryInfo sub={sub} />
    </AccordianCard>
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
            @{sub.user.name}<span> </span><Hat className='fill-grey' user={sub.user} height={12} width={12} />
          </Link>
        </div>
        <div className='text-muted'>
          <span>post cost </span>
          <span className='fw-bold'>{numWithUnits(sub.baseCost)}</span>
        </div>
        <TerritoryBillingLine sub={sub} />
      </CardFooter>
    </>
  )
}

export default function TerritoryHeader ({ sub }) {
  const me = useMe()
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
    <>
      <TerritoryPaymentDue sub={sub} />
      <div className='mb-3'>
        <div>
          <TerritoryDetails sub={sub} />
        </div>
        <div className='d-flex my-2 justify-content-end'>
          <Share path={`/~${sub.name}`} title={`~${sub.name} stacker news territory`} className='mx-3' />
          {me &&
            (Number(sub.userId) === Number(me?.id)
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
                </Button>))}
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
        console.log(sub, toggleMuteSub)
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
