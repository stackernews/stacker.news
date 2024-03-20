import { SUB } from '@/fragments/subs'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { CenterLayout } from '@/components/layout'
import TerritoryForm from '@/components/territory-form'
import PageLoading from '@/components/page-loading'
import { useQuery } from '@apollo/client'
import { useRouter } from 'next/router'
import TerritoryPaymentDue from '@/components/territory-payment-due'

export const getServerSideProps = getGetServerSideProps({
  query: SUB,
  notFound: (data, vars, me) => !data.sub || Number(data.sub.userId) !== Number(me?.id),
  authRequired: true
})

export default function TerritoryPage ({ ssrData }) {
  const router = useRouter()
  const { data } = useQuery(SUB, { variables: { sub: router.query.sub } })
  if (!data && !ssrData) return <PageLoading />

  const { sub } = data || ssrData

  return (
    <CenterLayout sub={sub?.name}>
      <TerritoryPaymentDue sub={sub} />
      <h1 className='mt-5'>edit territory</h1>
      <TerritoryForm sub={sub} />
    </CenterLayout>
  )
}
