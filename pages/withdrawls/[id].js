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
        msatsFeePaying
        status
      }
    }`
  return (
    <LayoutCenter>
      <LoadWithdrawl query={query} />
    </LayoutCenter>
  )
}

function LoadWithdrawl ({ query }) {
  const { loading, error, data } = useQuery(query, { pollInterval: 1000 })
  if (error) return <div>error</div>
  if (!data || loading) {
    return (
      <>
        <div className='w-100'>
          <InputSkeleton label='invoice' />
        </div>
        <div className='w-100'>
          <InputSkeleton label='max fee' />
        </div>
        <InvoiceStatus status='pending' />
      </>
    )
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
          placeholder={data.withdrawl.msatsFeePaying} readOnly
          append={<InputGroup.Text className='text-monospace'>millisats</InputGroup.Text>}
        />
      </div>
      <InvoiceStatus status='pending' />
    </>
  )
}
