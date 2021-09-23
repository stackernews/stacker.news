import Layout from '../../components/layout'
import { ITEM_FIELDS } from '../../fragments/items'
import { gql } from '@apollo/client'
import Seo from '../../components/seo'
import ApolloClient from '../../api/client'
import ItemFull from '../../components/item-full'

// ssr the item without comments so that we can populate metatags
export async function getServerSideProps ({ req, params: { id } }) {
  if (isNaN(id)) {
    return {
      notFound: true
    }
  }

  const { error, data: { item } } = await (await ApolloClient(req)).query({
    query:
      gql`
        ${ITEM_FIELDS}
        {
          item(id: ${id}) {
            ...ItemFields
            text
        }
      }`
  })

  if (!item || error) {
    return {
      notFound: true
    }
  }

  return {
    props: {
      item
    }
  }
}

export default function AnItem ({ item }) {
  return (
    <Layout noSeo>
      <Seo item={item} />
      <ItemFull item={item} />
    </Layout>
  )
}
