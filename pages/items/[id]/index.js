import Layout from '../../../components/layout'
import { ITEM_FULL } from '../../../fragments/items'
import Seo from '../../../components/seo'
import ItemFull from '../../../components/item-full'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import { useQuery } from '@apollo/client'

export const getServerSideProps = getGetServerSideProps(ITEM_FULL)

export default function AnItem ({ data: { item } }) {
  const { data } = useQuery(ITEM_FULL, {
    variables: { id: item.id }
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
