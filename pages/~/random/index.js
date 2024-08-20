import Layout from '@/components/layout'
import Items from '@/components/items'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { SUB_ITEMS } from '@/fragments/subs'
import { useRouter } from 'next/router'

const staticVariables = { sort: 'random' }
const variablesFunc = vars =>
  ({ ...staticVariables, ...vars })
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
      <Items
        ssrData={ssrData}
        query={SUB_ITEMS}
        variables={variables}
        noMoreText='NO MORE'
      />
    </Layout>
  )
}
