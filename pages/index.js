import Layout from '../components/layout'
import Items from '../components/items'

export default function Index () {
  return (
    <Layout>
      <Items variables={{ sort: 'hot' }} rank />
    </Layout>
  )
}
