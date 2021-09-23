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
import Link from 'next/link'
import { useMe } from './me'

function BioItem ({ item }) {
  const me = useMe()
  if (!item.text) {
    return null
  }

  return (
    <>
      <ItemText item={item} />
      {me?.name === item.user.name &&
        <Link href={`/items/${item.id}/edit`} passHref>
          <a className='text-right'>edit bio</a>
        </Link>}
      <Reply parentId={item.id} />
    </>
  )
}

function TopLevelItem ({ item }) {
  return (
    <Item item={item}>
      {item.text && <ItemText item={item} />}
      <Reply parentId={item.id} replyOpen />
    </Item>
  )
}

function ItemText ({ item }) {
  return <Text nofollow={item.sats + item.boost < NOFOLLOW_LIMIT}>{item.text}</Text>
}

export default function ItemFull ({ item: qItem, bio }) {
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
        : (bio
            ? <BioItem item={item} />
            : <TopLevelItem item={item} />
          )}
      <div className={styles.comments}>
        <Comments comments={item.comments} />
      </div>
    </>
  )
}
