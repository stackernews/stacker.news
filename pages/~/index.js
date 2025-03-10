import { useRouter } from 'next/router'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Items from '@/components/items'
import Layout from '@/components/layout'
import { SUB_FULL, SUB_ITEMS } from '@/fragments/subs'
import Snl from '@/components/snl'
import { useQuery } from '@apollo/client'
import PageLoading from '@/components/page-loading'
import TerritoryHeader from '@/components/territory-header'

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

  const path = router.asPath.split('?')[0]
  // TODO: this works but it can be better
  const isCustomDomain = sub && !path.includes(`/~${sub?.name}`)

  return (
    <Layout sub={sub?.name}>
      {sub && !isCustomDomain
        ? <TerritoryHeader sub={sub} />
        : (
          <>
            <Snl />
          </>)}
      <Items ssrData={ssrData} variables={variables} />
    </Layout>
  )
}
