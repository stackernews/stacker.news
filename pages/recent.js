import Layout from '../components/layout'
import Items from '../components/items'
import { ITEMS_RECENT } from '../fragments/items'

export default function Index () {
  return (
    <Layout>
      <Items query={ITEMS_RECENT} rank />
    </Layout>
  )
}
