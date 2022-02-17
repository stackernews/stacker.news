import { getGetServerSideProps } from '../../../api/ssrApollo'
import Items from '../../../components/items'
import Layout from '../../../components/layout'
import { SUB_ITEMS } from '../../../fragments/subs'

export const getServerSideProps = getGetServerSideProps(SUB_ITEMS)

export default function Sub ({ data: { sub: { name }, items: { items, cursor } } }) {
  return (
    <Layout sub={name}>
      <Items
        items={items} cursor={cursor} rank
        variables={{ sub: name }}
      />
    </Layout>
  )
}
