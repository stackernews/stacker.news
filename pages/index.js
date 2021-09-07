import Layout from '../components/layout'
import Items from '../components/items'
import { useRouter } from 'next/router'

export default function Index () {
  const router = useRouter()
  return (
    <Layout>
      <Items variables={{ sort: 'hot' }} rank key={router.query.key} />
    </Layout>
  )
}
