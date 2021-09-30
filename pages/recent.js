import Layout from '../components/layout'
import Items from '../components/items'
import { useRouter } from 'next/router'
import getSSRApolloClient from '../api/ssrApollo'
import { MORE_ITEMS } from '../fragments/items'

export async function getServerSideProps ({ req }) {
  const client = await getSSRApolloClient(req)
  const { data } = await client.query({
    query: MORE_ITEMS,
    variables: { sort: 'recent' }
  })

  let items, cursor
  if (data) {
    ({ moreItems: { items, cursor } } = data)
  }

  return {
    props: {
      items,
      cursor
    }
  }
}

export default function Index ({ items, cursor }) {
  const router = useRouter()
  return (
    <Layout>
      <Items
        items={items} cursor={cursor}
        variables={{ sort: 'recent' }} rank key={router.query.key}
      />
    </Layout>
  )
}
