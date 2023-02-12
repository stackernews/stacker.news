import { useMutation } from '@apollo/client'
import { gql } from 'apollo-server-micro'
import BookmarkIcon from '../svgs/bookmark.svg'

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
    <div className='d-flex align-items-center'>
      <BookmarkIcon className={`${meBookmark ? 'fill-success' : ''} theme`} onClick={() => bookmarkItem({ variables: { id }})} />
    </div>
  )
}
