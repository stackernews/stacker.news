import { useQuery, useMutation } from '@apollo/client'
import { CenterLayout } from '@/components/layout'
import { CopyInput, Input, InputSkeleton } from '@/components/form'
import InputGroup from 'react-bootstrap/InputGroup'
import InvoiceStatus from '@/components/invoice-status'
import { useRouter } from 'next/router'
import { WITHDRAWL } from '@/fragments/invoice'
import Link from 'next/link'
import { SSR, INVOICE_RETENTION_DAYS, FAST_POLL_INTERVAL } from '@/lib/constants'
import { numWithUnits } from '@/lib/format'
import Bolt11Info from '@/components/bolt11-info'
import { datePivot, timeLeft } from '@/lib/time'
import { useMe } from '@/components/me'
import { useToast } from '@/components/toast'
import { gql } from 'graphql-tag'
import { useShowModal } from '@/components/modal'
import { DeleteConfirm } from '@/components/delete'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { Badge } from 'react-bootstrap'
import styles from '@/components/invoice.module.css'
// force SSR to include CSP nonces
export const getServerSideProps = getGetServerSideProps({ query: null })

export default function Withdrawl () {
  return (
    <CenterLayout>
      <LoadWithdrawl />
    </CenterLayout>
  )
}

export function WithdrawlSkeleton ({ status }) {
  return (
    <>
      <div className='w-100 form-group'>
        <InputSkeleton label='invoice' />
      </div>
      <div className='w-100 form-group'>
        <InputSkeleton label='max fee' />
      </div>
      <InvoiceStatus status={status} />
      <div className='w-100 mt-3'>
        <Bolt11Info />
      </div>
    </>
  )
}

function LoadWithdrawl () {
  const router = useRouter()
  const { loading, error, data } = useQuery(WITHDRAWL, SSR
    ? {}
    : {
        variables: { id: router.query.id },
        pollInterval: FAST_POLL_INTERVAL,
        nextFetchPolicy: 'cache-and-network'
      })
  if (error) return <div>error</div>
  if (!data || loading) {
    return <WithdrawlSkeleton status='loading' />
  }

  const TryMaxFee = () =>
    <Link href='/wallet?type=withdraw' className='text-reset text-underline'>
      <small className='ms-3'>try increasing max fee</small>
    </Link>

  let status = 'pending'
  let variant = 'default'
  switch (data.withdrawl.status) {
    case 'CONFIRMED':
      if (data.withdrawl.forwardedActionType) {
        status = <>{`forwarded ${numWithUnits(data.withdrawl.satsPaid, { abbreviate: false })}`} <Badge className={styles.badge} bg={null}>p2p</Badge></>
      } else {
        status = `sent ${numWithUnits(data.withdrawl.satsPaid, { abbreviate: false })} with ${numWithUnits(data.withdrawl.satsFeePaid, { abbreviate: false })} in routing fees`
      }
      variant = 'confirmed'
      break
    case 'INSUFFICIENT_BALANCE':
      status = <>insufficient balance <small className='ms-3'>contact keyan!</small></>
      variant = 'failed'
      break
    case 'INVALID_PAYMENT':
      status = 'invalid invoice'
      variant = 'failed'
      break
    case 'PATHFINDING_TIMEOUT':
      status = <>timed out finding route <TryMaxFee /></>
      variant = 'failed'
      break
    case 'ROUTE_NOT_FOUND':
      status = <>no route <TryMaxFee /></>
      variant = 'failed'
      break
    case 'UNKNOWN_FAILURE':
      status = <>unknown error</>
      variant = 'failed'
      break
    default:
      break
  }

  return (
    <>
      <div className='w-100'>
        <CopyInput
          label='invoice' type='text'
          placeholder={data.withdrawl.bolt11 || 'deleted'} readOnly noForm
        />
      </div>
      <div className='w-100'>
        <Input
          label='max fee' type='text'
          placeholder={data.withdrawl.satsFeePaying} readOnly noForm
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
      </div>
      <InvoiceStatus variant={variant} status={status} />
      <div className='w-100 mt-3'>
        <Bolt11Info bolt11={data.withdrawl.bolt11} preimage={data.withdrawl.preimage}>
          <PrivacyOption payment={data.withdrawl} />
        </Bolt11Info>
      </div>
    </>
  )
}

export function PrivacyOption ({ payment }) {
  if (!payment.bolt11) return

  const { me } = useMe()
  const keepUntil = datePivot(new Date(payment.createdAt), { days: INVOICE_RETENTION_DAYS })
  const oldEnough = new Date() >= keepUntil
  if (!oldEnough) {
    return (
      <span className='text-muted fst-italic'>
        {`this invoice ${me.privates?.autoDropBolt11s ? 'will be auto-deleted' : 'can be deleted'} in ${timeLeft(keepUntil)}`}
      </span>
    )
  }

  const showModal = useShowModal()
  const toaster = useToast()
  const [dropBolt11] = useMutation(
    gql`
      mutation dropBolt11($hash: String!) {
        dropBolt11(hash: $hash)
      }`, {
      update (cache, { data }) {
        if (data.dropBolt11) {
          cache.modify({
            id: `${payment.__typename}:${payment.id}`,
            fields: {
              bolt11: () => null,
              hash: () => null
            }
          })
        }
      }
    })

  return (
    <span
      className='btn btn-md btn-danger' onClick={() => {
        showModal(onClose => {
          return (
            <DeleteConfirm
              type='invoice'
              onConfirm={async () => {
                if (me) {
                  try {
                    await dropBolt11({ variables: { hash: payment.hash } })
                  } catch (err) {
                    toaster.danger('unable to delete invoice: ' + err.message || err.toString?.())
                    throw err
                  } finally {
                    onClose()
                  }
                }
              }}
            />
          )
        })
      }}
    >delete invoice
    </span>
  )
}
