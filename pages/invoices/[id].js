import { useQuery } from '@apollo/client'
import { Invoice } from '../../components/invoice'
import { QrSkeleton } from '../../components/qr'
import { CenterLayout } from '../../components/layout'
import { useRouter } from 'next/router'
import { INVOICE } from '../../fragments/wallet'
import { SSR } from '../../lib/constants'

export default function FullInvoice () {
  const router = useRouter()
  const { data, error } = useQuery(INVOICE, SSR
    ? {}
    : {
        pollInterval: 1000,
        variables: { id: router.query.id },
        nextFetchPolicy: 'cache-and-network'
      })

  return (
    <CenterLayout>
      {error && <div>{error.toString()}</div>}
      {data ? <Invoice invoice={data.invoice} /> : <QrSkeleton description status='loading' />}
    </CenterLayout>
  )
}
