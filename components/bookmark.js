import { useMutation } from '@apollo/client'
import { gql } from 'graphql-tag'
import Dropdown from 'react-bootstrap/Dropdown'
import { useToast } from './toast'

export default function BookmarkDropdownItem ({ item: { id, meBookmark } }) {
  const dispatchToast = useToast()
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
            meBookmark: () => bookmarkItem.meBookmark
          }
        })
      }
    }
  )
  return (
    <Dropdown.Item
      onClick={async () => {
        try {
          await bookmarkItem({ variables: { id } })
          dispatchToast({ body: meBookmark ? 'Bookmarked successfully removed!' : 'Bookmark successfully added!', variant: 'success', autohide: true, delay: 5000 })
        } catch (err) {
          console.error(err)
          dispatchToast({ header: 'Error', body: meBookmark ? 'Failed to remove bookmark' : 'Failed to bookmark', variant: 'danger', autohide: false })
        }
      }}
    >
      {meBookmark ? 'remove bookmark' : 'bookmark'}
    </Dropdown.Item>
  )
}
