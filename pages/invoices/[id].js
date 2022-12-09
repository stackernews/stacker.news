import { useQuery } from '@apollo/client'
import { Invoice } from '../../components/invoice'
import { LnQRSkeleton } from '../../components/lnqr'
import LayoutCenter from '../../components/layout-center'
import { useRouter } from 'next/router'
import { INVOICE } from '../../fragments/wallet'

export default function FullInvoice () {
  return (
    <LayoutCenter>
      <LoadInvoice />
    </LayoutCenter>
  )
}

function LoadInvoice () {
  const router = useRouter()
  const { loading, error, data } = useQuery(INVOICE, {
    pollInterval: 1000,
    variables: { id: router.query.id }
  })
  if (error) {
    console.log(error)
    return <div>error</div>
  }
  if (!data || loading) {
    return <LnQRSkeleton status='loading' />
  }

  return <Invoice invoice={data.invoice} />
}
