// ssr the related query with an adequate limit
// need to use a cursor on related
import { RELATED_ITEMS, RELATED_ITEMS_WITH_ITEM } from '@/fragments/items'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Items from '@/components/items'
import Layout from '@/components/layout'
import { useRouter } from 'next/router'
import Item from '@/components/item'
import { useQuery } from '@apollo/client'
import PageLoading from '@/components/page-loading'

export const getServerSideProps = getGetServerSideProps({
  query: RELATED_ITEMS_WITH_ITEM,
  notFound: data => !data.item
})

export default function Related ({ ssrData }) {
  const router = useRouter()

  const { data } = useQuery(RELATED_ITEMS_WITH_ITEM, { variables: { id: router.query.id } })
  if (!data && !ssrData) return <PageLoading />

  const { item } = data || ssrData

  return (
    <Layout>
      <Item item={item} />
      <div className='fw-bold mt-2'>related</div>
      <Items
        ssrData={ssrData}
        query={RELATED_ITEMS}
        destructureData={data => data.related}
        variables={{ id: router.query.id }}
      />
    </Layout>
  )
}
