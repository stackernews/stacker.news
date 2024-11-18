import Layout from '@/components/layout'
import Items from '@/components/items'
import { getGetServerSideProps } from '@/api/ssrApollo'
import RecentHeader from '@/components/recent-header'
import { useRouter } from 'next/router'
import { SUB_FULL, SUB_ITEMS } from '@/fragments/subs'
import { COMMENT_TYPE_QUERY } from '@/lib/constants'
import { useQuery } from '@apollo/client'
import PageLoading from '@/components/page-loading'

const staticVariables = { sort: 'recent' }

function variablesFunc (vars) {
  let type = vars?.type || ''

  if (type === 'bounties' && vars?.active) {
    type = 'bounties_active'
  }

  return ({
    includeComments: COMMENT_TYPE_QUERY.includes(vars.type),
    ...staticVariables,
    ...vars,
    type
  })
}

export const getServerSideProps = getGetServerSideProps({
  query: SUB_ITEMS,
  variables: variablesFunc,
  notFound: (data, vars) => vars.sub && !data.sub
})

export default function Index ({ ssrData }) {
  const router = useRouter()
  const variables = variablesFunc(router.query)
  const { data } = useQuery(SUB_FULL, { variables })

  if (!data && !ssrData) return <PageLoading />
  const { sub } = data || ssrData

  return (
    <Layout sub={sub?.name}>
      <RecentHeader sub={sub} />
      <Items
        ssrData={ssrData}
        query={SUB_ITEMS}
        variables={variables}
      />
    </Layout>
  )
}
