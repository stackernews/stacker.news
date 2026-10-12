import { SUB_EDIT } from '@/fragments/subs'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { CenterLayout } from '@/components/layout'
import TerritoryForm from '@/components/territory-form'
import PageLoading from '@/components/page-loading'
import { useQuery } from '@apollo/client/react'
import { useRouter } from 'next/router'
import TerritoryPaymentDue from '@/components/territory-payment-due'
import Custom404 from '../404'

// SUB_EDIT bundles SubFields + owner-only domain (records/attempts) and branding (theme/seo)
export const getServerSideProps = getGetServerSideProps({
  query: SUB_EDIT,
  notFound: (data, vars, me) => !data.sub || Number(data.sub.userId) !== Number(me?.id),
  authRequired: true
})

export default function TerritoryPage ({ ssrData }) {
  const router = useRouter()
  const { data } = useQuery(SUB_EDIT, { variables: { sub: router.query.sub } })
  if (!data && !ssrData) return <PageLoading />

  const { sub } = data || ssrData
  if (!sub) return <Custom404 />

  return (
    <CenterLayout sub={sub?.name}>
      <TerritoryPaymentDue key={`payment-${sub.name}`} sub={sub} />
      <h1 className='mt-12'>edit territory</h1>
      <TerritoryForm key={`edit-${sub.name}`} sub={sub} />
    </CenterLayout>
  )
}
