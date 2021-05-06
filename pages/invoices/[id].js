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
      invoice(id: ${id})
    }`
  return (
    <LayoutCenter>
      <LoadInvoice query={query} />
    </LayoutCenter>
  )
}

function LoadInvoice ({ query }) {
  const { loading, error, data } = useQuery(query)
  if (error) return <div>error</div>
  if (!data || loading) {
    return <InvoiceSkeleton />
  }

  return <Invoice invoice={data.invoice} />
}
