import Layout from '../../../components/layout'
import { ITEM_FULL } from '../../../fragments/items'
import Seo from '../../../components/seo'
import ItemFull from '../../../components/item-full'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import { useQuery } from '@apollo/client'

export const getServerSideProps = getGetServerSideProps(ITEM_FULL, null,
  data => !data.item || (data.item.status === 'STOPPED' && !data.item.mine))

export default function AnItem ({ data: { item } }) {
  const { data } = useQuery(ITEM_FULL, {
    variables: { id: item.id }
  })
  if (data) {
    ({ item } = data)
  }

  const sub = item.subName || item.root?.subName

  return (
    <Layout sub={sub} noSeo>
      <Seo item={item} sub={sub} />
      <ItemFull item={item} />
    </Layout>
  )
}
