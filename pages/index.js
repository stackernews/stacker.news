import Layout from '../components/layout'
import Items from '../components/items'
import { getGetServerSideProps } from '../api/ssrApollo'
import { ITEMS } from '../fragments/items'
import Snl from '../components/snl'

export const getServerSideProps = getGetServerSideProps(ITEMS)

export default function Index ({ data: { items: { items, pins, cursor } } }) {
  return (
    <Layout>
      <Snl />
      <Items
        items={items} pins={pins} cursor={cursor}
        rank
      />
    </Layout>
  )
}
