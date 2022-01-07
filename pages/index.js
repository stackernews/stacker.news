import Layout from '../components/layout'
import Items from '../components/items'
import { getGetServerSideProps } from '../api/ssrApollo'
import { MORE_ITEMS } from '../fragments/items'

const variables = { sort: 'hot' }
export const getServerSideProps = getGetServerSideProps(MORE_ITEMS, variables)

export default function Index ({ data: { moreItems: { items, pins, cursor } } }) {
  return (
    <Layout>
      <Items
        items={items} pins={pins} cursor={cursor}
        variables={variables} rank
      />
    </Layout>
  )
}
