// ssr the related query with an adequate limit
// need to use a cursor on related
import { RELATED_ITEMS, RELATED_ITEMS_WITH_ITEM } from '../../../fragments/items'
import { getGetServerSideProps } from '../../../api/ssrApollo'
import Items from '../../../components/items'
import Layout from '../../../components/layout'
import { useRouter } from 'next/router'
import Item from '../../../components/item'

export const getServerSideProps = getGetServerSideProps(RELATED_ITEMS_WITH_ITEM, null,
  data => !data.item)

export default function Related ({ data: { item, related: { items, cursor } } }) {
  const router = useRouter()

  return (
    <Layout>
      <Item item={item} />
      <div className='font-weight-bold my-2'>related</div>
      <Items
        items={items} cursor={cursor}
        query={RELATED_ITEMS}
        destructureData={data => data.related}
        variables={{ id: router.query.id }}
      />
    </Layout>
  )
}
