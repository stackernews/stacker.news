import Layout from '../../../components/layout'
import Items from '../../../components/items'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import RecentHeader from '../../../components/recent-header'
import { useRouter } from 'next/router'
import { SUB_ITEMS } from '../../../fragments/subs'
import { COMMENT_TYPE_QUERY } from '../../../lib/constants'

const staticVariables = { sort: 'recent' }
const variablesFunc = vars =>
  ({ includeComments: COMMENT_TYPE_QUERY.includes(vars.type), ...staticVariables, ...vars })
export const getServerSideProps = getGetServerSideProps(
  SUB_ITEMS,
  variablesFunc,
  (data, vars) => vars.sub && !data.sub)

export default function Index ({ ssrData }) {
  const router = useRouter()
  const variables = variablesFunc(router.query)

  return (
    <Layout sub={variables.sub}>
      <RecentHeader sub={variables.sub} />
      <Items
        ssrData={ssrData}
        query={SUB_ITEMS}
        variables={variables}
      />
    </Layout>
  )
}
