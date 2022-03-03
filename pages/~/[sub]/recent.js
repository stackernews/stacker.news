import { getGetServerSideProps } from '../../../api/ssrApollo'
import Items from '../../../components/items'
import Layout from '../../../components/layout'
import { SUB_ITEMS } from '../../../fragments/subs'

const variables = { sort: 'recent' }
export const getServerSideProps = getGetServerSideProps(SUB_ITEMS, variables, 'sub')

// need to recent list items
export default function Sub ({ data: { sub: { name }, items: { items, cursor } } }) {
  return (
    <Layout sub={name}>
      <Items
        items={items} cursor={cursor}
        variables={{ sub: name, ...variables }} rank
      />
    </Layout>
  )
}
