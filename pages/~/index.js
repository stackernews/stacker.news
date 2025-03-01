import { useRouter } from 'next/router'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Items from '@/components/items'
import Layout from '@/components/layout'
import { SUB_FULL, SUB_ITEMS } from '@/fragments/subs'
import Snl from '@/components/snl'
import { useQuery } from '@apollo/client'
import PageLoading from '@/components/page-loading'
import TerritoryHeader from '@/components/territory-header'

export const multiOrSingleSub = (sub) => {
  return sub && !sub?.includes('+')
    ? sub
    : sub
      ? [...new Set(sub.split('+'))]
      : null
}

export const getServerSideProps = getGetServerSideProps({
  query: SUB_ITEMS,
  variables: (query) => ({
    ...query,
    sub: multiOrSingleSub(query.sub)
  }),
  notFound: (data, vars) => vars.sub && !data.sub
})

export default function Sub ({ ssrData }) {
  const router = useRouter()
  const variables = {
    ...router.query,
    sub: multiOrSingleSub(router.query.sub)
  }
  console.log('variables', variables)
  const { data } = useQuery(SUB_FULL, { variables })

  if (!data && !ssrData) return <PageLoading />
  const { sub } = data || ssrData

  return (
    <Layout sub={multiOrSingleSub(router.query.sub)}>
      {Array.isArray(sub) && sub.length === 1
        ? <TerritoryHeader sub={sub} />
        : (
          <>
            <Snl />
          </>)}
      <Items ssrData={ssrData} variables={variables} />
    </Layout>
  )
}
