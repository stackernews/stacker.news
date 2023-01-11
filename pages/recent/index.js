import Layout from '../../components/layout'
import Items from '../../components/items'
import { getGetServerSideProps } from '../../api/ssrApollo'
import { ITEMS } from '../../fragments/items'
import RecentHeader from '../../components/recent-header'

const variables = { sort: 'recent' }
export const getServerSideProps = getGetServerSideProps(ITEMS, variables)

export default function Index ({ data: { items: { items, cursor } } }) {
  return (
    <Layout>
      <RecentHeader type='posts' />
      <Items
        items={items} cursor={cursor}
        variables={variables} rank
      />
    </Layout>
  )
}
