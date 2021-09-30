import Layout from '../../../components/layout'
import { ITEM_FULL } from '../../../fragments/items'
import Seo from '../../../components/seo'
import ItemFull from '../../../components/item-full'
import getSSRApolloClient from '../../../api/ssrApollo'
import { useQuery } from '@apollo/client'
import { useRouter } from 'next/router'

export async function getServerSideProps ({ req, params: { id } }) {
  if (isNaN(id)) {
    return {
      notFound: true
    }
  }

  const client = await getSSRApolloClient(req)
  const { error, data } = await client.query({
    query: ITEM_FULL(id)
  })

  if (error || !data?.item) {
    return {
      notFound: true
    }
  }

  return {
    props: {
      item: data.item
    }
  }
}

export default function AnItem ({ item }) {
  const router = useRouter()
  const { data } = useQuery(ITEM_FULL(item.id), {
    fetchPolicy: router.query.cache ? 'cache-first' : undefined
  })
  if (data) {
    ({ item } = data)
  }

  return (
    <Layout noSeo>
      <Seo item={item} />
      <ItemFull item={item} />
    </Layout>
  )
}
