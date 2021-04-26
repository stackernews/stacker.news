import Item from '../../components/item'
import Layout from '../../components/layout'
import ApolloClient from '../../api/client'
import Reply from '../../components/reply'
import Comment from '../../components/comment'
import Text from '../../components/text'
import Comments from '../../components/comments'
import { COMMENTS } from '../../fragments/comments'
import { ITEM_FIELDS } from '../../fragments/items'
import { gql } from '@apollo/client'

export async function getServerSideProps ({ req, params }) {
  const { error, data: { item } } = await (await ApolloClient(req)).query({
    query:
      gql`
      ${ITEM_FIELDS}
      {
        item(id: ${params.id}) {
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
      item: item
    }
  }
}

export default function FullItem ({ item }) {
  const commentsQuery = gql`
    ${COMMENTS}
    {
      comments(parentId: ${item.id}) {
        ...CommentsRecursive
      }
  }`

  return (
    <Layout>
      {item.parentId
        ? <Comment item={item} replyOpen includeParent cacheId='ROOT_QUERY' />
        : (
          <>
            <Item item={item}>
              {item.text && <Text>{item.text}</Text>}
              <Reply parentId={item.id} cacheId='ROOT_QUERY' />
            </Item>
          </>
          )}
      <div className='mt-5'>
        <Comments query={commentsQuery} />
      </div>
    </Layout>
  )
}
