import { useMutation } from '@apollo/client'
import { gql } from 'apollo-server-micro'
import StarIcon from '../svgs/star.svg'

export default function Bookmark ({ item: { id, meBookmark } }) {
  const [bookmarkItem] = useMutation(
    gql`
      mutation bookmarkItem($id: ID!) {
        bookmarkItem(id: $id) {
          meBookmark
        }
      }`, {
      update (cache, { data: { bookmarkItem } }) {
        cache.modify({
          id: `Item:${id}`,
          fields: {
            meBookmark: () => bookmarkItem.meBookmark,
          }
        })
      }
    }
  )
  return (
    <StarIcon className={`${meBookmark ? 'fill-success' : ''} ml-1 theme`} width={16} height={16} onClick={() => bookmarkItem({ variables: { id }})} />
  )
}
