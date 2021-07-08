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
import ApolloClient from '../../api/client'

// ssr the item without comments so that we can populate metatags
export async function getServerSideProps ({ req, params: { id } }) {
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

export default function FullItem ({ item }) {
  const query = gql`
    ${ITEM_FIELDS}
    ${COMMENTS}
    {
      item(id: ${item.id}) {
        ...ItemFields
        text
        comments {
          ...CommentsRecursive
        }
    }
  }`

  return (
    <Layout noSeo>
      <Seo item={item} />
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
