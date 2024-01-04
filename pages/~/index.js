import { useRouter } from 'next/router'
import { getGetServerSideProps } from '../../api/ssrApollo'
import Items from '../../components/items'
import Layout from '../../components/layout'
import { SUB_FULL, SUB_ITEMS } from '../../fragments/subs'
import Snl from '../../components/snl'
import { WelcomeBanner } from '../../components/banners'
import { useQuery } from '@apollo/client'
import PageLoading from '../../components/page-loading'
import TerritoryHeader from '../../components/territory-header'
import { useEffect } from 'react'

export const getServerSideProps = getGetServerSideProps({
  query: SUB_ITEMS,
  notFound: (data, vars) => vars.sub && !data.sub
})

export default function Sub ({ ssrData }) {
  const router = useRouter()
  const variables = { ...router.query }
  const { data } = useQuery(SUB_FULL, { variables })

  if (!data && !ssrData) return <PageLoading />
  const { sub } = data || ssrData

  // basically a client-side redirect to the canonical url
  useEffect(() => {
    if (sub?.name && sub?.name !== router.query.sub) {
      router.replace({
        pathname: router.pathname,
        query: { ...router.query, sub: sub.name }
      }, `/~${sub.name}`)
    }
  }, [sub?.name])

  return (
    <Layout sub={variables.sub}>
      {sub
        ? <TerritoryHeader sub={sub} />
        : (
          <>
            <Snl />
            <WelcomeBanner />
          </>)}
      <Items ssrData={ssrData} variables={variables} />
    </Layout>
  )
}
