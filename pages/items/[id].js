import Item, { ItemSkeleton } from '../../components/item'
import Layout from '../../components/layout'
import Reply, { ReplySkeleton } from '../../components/reply'
import Comment from '../../components/comment'
import Text from '../../components/text'
import Comments, { CommentsSkeleton } from '../../components/comments'
import { COMMENTS } from '../../fragments/comments'
import { ITEM_FIELDS } from '../../fragments/items'
import { gql, useQuery } from '@apollo/client'
import { useRouter } from 'next/router'

export default function FullItem ({ item }) {
  const router = useRouter()
  const { id } = router.query

  const query = gql`
    ${ITEM_FIELDS}
    ${COMMENTS}
    {
      item(id: ${id}) {
        ...ItemFields
        text
        comments {
          ...CommentsRecursive
        }
    }
  }`

  return (
    <Layout>
      <LoadItem query={query} />
    </Layout>
  )
}

function LoadItem ({ query }) {
  const { loading, error, data } = useQuery(query)
  if (error) return <div>Failed to load!</div>

  if (loading) {
    return (
      <div>
        <ItemSkeleton>
          <ReplySkeleton />
        </ItemSkeleton>
        <div className='mt-5'>
          <CommentsSkeleton />
        </div>
      </div>
    )
  }

  const { item } = data

  return (
    <>
      {item.parentId
        ? <Comment item={item} replyOpen includeParent noComments />
        : (
          <>
            <Item item={item}>
              {item.text && <Text>{item.text}</Text>}
              <Reply parentId={item.id} />
            </Item>
          </>
          )}
      <div className='mt-5'>
        <Comments comments={item.comments} />
      </div>
    </>
  )
}
