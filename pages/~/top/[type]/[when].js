import Layout from '@/components/layout'
import Items from '@/components/items'
import { useRouter } from 'next/router'
import { getGetServerSideProps } from '@/api/ssrApollo'
import TopHeader from '@/components/top-header'
import { SUB_ITEMS } from '@/fragments/subs'
import { COMMENT_TYPE_QUERY } from '@/lib/constants'

const staticVariables = { sort: 'top' }
const variablesFunc = vars => {
  return ({ includeComments: COMMENT_TYPE_QUERY.includes(vars.type), ...staticVariables, ...vars })
}
export const getServerSideProps = getGetServerSideProps({
  query: SUB_ITEMS,
  variables: variablesFunc,
  notFound: (data, vars) => vars.sub && !data.sub
})

export default function Index ({ ssrData }) {
  const router = useRouter()
  const variables = variablesFunc(router.query)

  const sub = ssrData?.sub?.name || variables.sub

  return (
    <Layout sub={sub}>
      <TopHeader sub={variables.sub} cat={variables.type} />
      <Items
        ssrData={ssrData}
        query={SUB_ITEMS}
        variables={variables}
        noMoreText='NO MORE'
      />
    </Layout>
  )
}
