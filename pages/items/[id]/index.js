import Layout from '@/components/layout'
import { ITEM_FULL } from '@/fragments/items'
import ItemFull from '@/components/item-full'
import Related from '@/components/related'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { useQuery } from '@apollo/client/react'
import { useRouter } from 'next/router'
import PageLoading from '@/components/page-loading'
import { CommentsNavigatorProvider } from '@/components/use-comments-navigator'
import { useState } from 'react'

export const getServerSideProps = getGetServerSideProps({
  query: ITEM_FULL,
  notFound: data => !data.item || (data.item.status === 'STOPPED' && !data.item.mine)
})

export default function Item ({ ssrData }) {
  const router = useRouter()
  const [tocContainer, setTocContainer] = useState(null)

  const { data, fetchMore } = useQuery(ITEM_FULL, { variables: { ...router.query } })
  if (!data && !ssrData) return <PageLoading />

  const { item } = data || ssrData
  const sub = item.subNames?.[0] || item.root?.subNames?.[0]

  const fetchMoreComments = async () => {
    await fetchMore({ variables: { ...router.query, cursor: item.comments.cursor } })
  }

  return (
    <CommentsNavigatorProvider key={item.id}>
      <Layout
        sub={sub} item={item} twoColumns
        sidebar={
          <div className='flex flex-col gap-4'>
            {!item.parentId && <div ref={setTocContainer} className='empty:hidden' />}
            <Related item={item} compact show />
          </div>
        }
      >
        <ItemFull item={item} fetchMoreComments={fetchMoreComments} tocContainer={tocContainer} />
      </Layout>
    </CommentsNavigatorProvider>
  )
}
