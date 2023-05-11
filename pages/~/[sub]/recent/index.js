import { getGetServerSideProps } from '../../../../api/ssrApollo'
import Items from '../../../../components/items'
import Layout from '../../../../components/layout'
import RecentHeader from '../../../../components/recent-header'
import { SUB_ITEMS } from '../../../../fragments/subs'

const variables = { sort: 'recent' }
export const getServerSideProps = getGetServerSideProps(SUB_ITEMS, variables,
  data => !data.sub)

// need to recent list items
export default function Sub ({ data: { sub, items: { items, cursor } } }) {
  return (
    <Layout sub={sub?.name}>
      {sub?.name !== 'jobs' && <RecentHeader type='posts' sub={sub} />}
      <Items
        items={items} cursor={cursor}
        variables={{ sub: sub?.name, ...variables }} rank
      />
    </Layout>
  )
}
