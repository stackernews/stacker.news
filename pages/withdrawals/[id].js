import { useQuery } from '@apollo/client'
import { CenterLayout } from '../../components/layout'
import { CopyInput, Input, InputSkeleton } from '../../components/form'
import InputGroup from 'react-bootstrap/InputGroup'
import InvoiceStatus from '../../components/invoice-status'
import { useRouter } from 'next/router'
import { WITHDRAWL } from '../../fragments/wallet'
import Link from 'next/link'
import { SSR } from '../../lib/constants'

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
      <div className='w-100'>
        <InputSkeleton label='invoice' />
      </div>
      <div className='w-100'>
        <InputSkeleton label='max fee' />
      </div>
      <InvoiceStatus status={status} />
    </>
  )
}

function LoadWithdrawl () {
  const router = useRouter()
  const { loading, error, data } = useQuery(WITHDRAWL, SSR
    ? {}
    : {
        variables: { id: router.query.id },
        pollInterval: 1000,
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
      status = `sent ${data.withdrawl.satsPaid} sats with ${data.withdrawl.satsFeePaid} sats in routing fees`
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
          placeholder={data.withdrawl.bolt11} readOnly noForm
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
    </>
  )
}
