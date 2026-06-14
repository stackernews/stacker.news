import { ITEM_REFERENCES, ITEM_REFERENCES_WITH_ITEM } from '@/fragments/items'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Items from '@/components/items'
import Layout from '@/components/layout'
import { useRouter } from 'next/router'
import Item from '@/components/item'
import { useQuery } from '@apollo/client/react'
import PageLoading from '@/components/page-loading'

export const getServerSideProps = getGetServerSideProps({
  query: ITEM_REFERENCES_WITH_ITEM,
  notFound: data => !data.item
})

export default function ReferencesPage ({ ssrData }) {
  const router = useRouter()

  const { data } = useQuery(ITEM_REFERENCES_WITH_ITEM, { variables: { id: router.query.id } })
  if (!data && !ssrData) return <PageLoading />

  const { item } = data || ssrData

  return (
    <Layout>
      <Item item={item} />
      <div className='fw-bold mt-2'>referenced by</div>
      <Items
        ssrData={ssrData}
        query={ITEM_REFERENCES}
        destructureData={data => data.references}
        variables={{ id: router.query.id }}
        noMoreText='no more'
      />
    </Layout>
  )
}
