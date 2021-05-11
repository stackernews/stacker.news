import { useQuery } from '@apollo/client'
import gql from 'graphql-tag'
import { Invoice, InvoiceSkeleton } from '../../components/invoice'
import LayoutCenter from '../../components/layout-center'

export async function getServerSideProps ({ params: { id } }) {
  return {
    props: {
      id
    }
  }
}

export default function FullInvoice ({ id }) {
  const query = gql`
    {
      invoice(id: ${id}) {
        id
        bolt11
        msatsReceived
        cancelled
        confirmedAt
        expiresAt
      }
    }`
  return (
    <LayoutCenter>
      <LoadInvoice query={query} />
    </LayoutCenter>
  )
}

function LoadInvoice ({ query }) {
  const { loading, error, data } = useQuery(query, { pollInterval: 1000 })
  if (error) return <div>error</div>
  if (!data || loading) {
    return <InvoiceSkeleton status='loading' />
  }

  return <Invoice invoice={data.invoice} />
}
