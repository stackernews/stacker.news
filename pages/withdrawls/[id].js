import { useQuery } from '@apollo/client'
import gql from 'graphql-tag'
import LayoutCenter from '../../components/layout-center'
import { CopyInput, Input, InputSkeleton } from '../../components/form'
import InputGroup from 'react-bootstrap/InputGroup'
import InvoiceStatus from '../../components/invoice-status'

export async function getServerSideProps ({ params: { id } }) {
  return {
    props: {
      id
    }
  }
}

export default function Withdrawl ({ id }) {
  const query = gql`
    {
      withdrawl(id: ${id}) {
        bolt11
        satsPaid
        satsFeePaying
        satsFeePaid
        status
      }
    }`
  return (
    <LayoutCenter>
      <LoadWithdrawl query={query} />
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

function LoadWithdrawl ({ query }) {
  const { loading, error, data } = useQuery(query, { pollInterval: 1000 })
  if (error) return <div>error</div>
  if (!data || loading) {
    return <WithdrawlSkeleton status='loading' />
  }

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
      status = <>timed out finding route <small className='ml-3'>try increasing max fee</small></>
      variant = 'failed'
      break
    case 'ROUTE_NOT_FOUND':
      status = <>no route <small className='ml-3'>try increasing max fee</small></>
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
          placeholder={data.withdrawl.bolt11} readOnly
        />
      </div>
      <div className='w-100'>
        <Input
          label='max fee' type='text'
          placeholder={data.withdrawl.satsFeePaying} readOnly
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
      </div>
      <InvoiceStatus variant={variant} status={status} />
    </>
  )
}
