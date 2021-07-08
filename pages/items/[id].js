import Item, { ItemSkeleton } from '../../components/item'
import Layout from '../../components/layout'
import Reply, { ReplySkeleton } from '../../components/reply'
import Comment from '../../components/comment'
import Text from '../../components/text'
import Comments, { CommentsSkeleton } from '../../components/comments'
import { COMMENTS } from '../../fragments/comments'
import { ITEM_FIELDS } from '../../fragments/items'
import { gql, useQuery } from '@apollo/client'
import styles from '../../styles/item.module.css'
import Seo from '../../components/seo'

export async function getServerSideProps ({ params: { id } }) {
  return {
    props: {
      id
    }
  }
}

export default function FullItem ({ id }) {
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
    <Layout noSeo>
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
        <div className={styles.comments}>
          <CommentsSkeleton />
        </div>
      </div>
    )
  }

  const { item } = data

  return (
    <>
      <Seo item={item} />
      {item.parentId
        ? <Comment item={item} replyOpen includeParent noComments />
        : (
          <>
            <Item item={item}>
              {item.text && <div className='mb-3'><Text>{item.text}</Text></div>}
              <Reply parentId={item.id} />
            </Item>
          </>
          )}
      <div className={styles.comments}>
        <Comments comments={item.comments} />
      </div>
    </>
  )
}
