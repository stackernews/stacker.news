import { useQuery } from '@apollo/client'
import LayoutCenter from '../../components/layout-center'
import { CopyInput, Input, InputSkeleton } from '../../components/form'
import InputGroup from 'react-bootstrap/InputGroup'
import InvoiceStatus from '../../components/invoice-status'
import { useRouter } from 'next/router'
import { WITHDRAWL } from '../../fragments/wallet'
import Link from 'next/link'

export default function Withdrawl () {
  return (
    <LayoutCenter>
      <LoadWithdrawl />
    </LayoutCenter>
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
  const { loading, error, data } = useQuery(WITHDRAWL, {
    variables: { id: router.query.id },
    pollInterval: 1000
  })
  if (error) return <div>error</div>
  if (!data || loading) {
    return <WithdrawlSkeleton status='loading' />
  }

  const TryMaxFee = () =>
    <Link href='/wallet?type=withdraw' passHref>
      <a className='text-reset text-underline'><small className='ml-3'>try increasing max fee</small></a>
    </Link>

  let status = 'pending'
  let variant = 'default'
  switch (data.withdrawl.status) {
    case 'CONFIRMED':
      status = `sent ${data.withdrawl.satsPaid} sats with ${data.withdrawl.satsFeePaid} sats in routing fees`
      variant = 'confirmed'
      break
    case 'INSUFFICIENT_BALANCE':
      status = <>insufficient balance <small className='ml-3'>contact keyan!</small></>
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
