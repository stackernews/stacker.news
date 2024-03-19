import Layout from '@/components/layout'
import { ITEM_FULL } from '@/fragments/items'
import ItemFull from '@/components/item-full'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { useQuery } from '@apollo/client'
import { useRouter } from 'next/router'
import PageLoading from '@/components/page-loading'

export const getServerSideProps = getGetServerSideProps({
  query: ITEM_FULL,
  notFound: data => !data.item || (data.item.status === 'STOPPED' && !data.item.mine)
})

export default function Item ({ ssrData }) {
  const router = useRouter()

  const { data } = useQuery(ITEM_FULL, { variables: { ...router.query } })
  if (!data && !ssrData) return <PageLoading />

  const { item } = data || ssrData
  const sub = item.subName || item.root?.subName

  return (
    <Layout sub={sub} item={item}>
      <ItemFull item={item} />
    </Layout>
  )
}
