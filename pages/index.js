import Layout from '../components/layout'
import Items from '../components/items'
import { ITEMS_FEED } from '../fragments/items'

export default function Index () {
  return (
    <Layout>
      <Items query={ITEMS_FEED} rank />
    </Layout>
  )
}
