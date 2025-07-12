import Invoice from '@/components/invoice'
import { CenterLayout } from '@/components/layout'
import { useRouter } from 'next/router'
import { INVOICE_FULL } from '@/fragments/invoice'
import { getGetServerSideProps } from '@/api/ssrApollo'

// force SSR to include CSP nonces
export const getServerSideProps = getGetServerSideProps({ query: null })

export default function FullInvoice () {
  const router = useRouter()

  return (
    <CenterLayout>
      <Invoice id={router.query.id} query={INVOICE_FULL} poll description status='loading' bolt11Info />
    </CenterLayout>
  )
}
