import Item, { ItemSkeleton } from './item'
import Reply, { ReplySkeleton } from './reply'
import Comment from './comment'
import Text from './text'
import Comments, { CommentsSkeleton } from './comments'
import { COMMENTS } from '../fragments/comments'
import { ITEM_FIELDS } from '../fragments/items'
import { gql, useQuery } from '@apollo/client'
import styles from '../styles/item.module.css'
import { NOFOLLOW_LIMIT } from '../lib/constants'
import { useRouter } from 'next/router'

export default function ItemFull ({ item: qItem, minimal }) {
  const query = gql`
    ${ITEM_FIELDS}
    ${COMMENTS}
    {
      item(id: ${qItem.id}) {
        ...ItemFields
        text
        comments {
          ...CommentsRecursive
        }
    }
  }`

  const router = useRouter()
  const { error, data } = useQuery(query, {
    fetchPolicy: router.query.cache ? 'cache-first' : undefined
  })
  if (error) return <div>Failed to load!</div>

  if (!data) {
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
        : (minimal
            ? (
              <>
                {item.text &&
                  <div className='mb-3'>
                    <Text nofollow={item.sats + item.boost < NOFOLLOW_LIMIT}>{item.text}</Text>
                  </div>}
              </>)
            : (
              <>
                <Item item={item}>
                  {item.text &&
                    <div className='mb-3'>
                      <Text nofollow={item.sats + item.boost < NOFOLLOW_LIMIT}>{item.text}</Text>
                    </div>}
                  <Reply parentId={item.id} />
                </Item>
              </>)
          )}
      <div className={styles.comments}>
        <Comments comments={item.comments} />
      </div>
    </>
  )
}
