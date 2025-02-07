import { useMutation } from '@apollo/client'
import { gql } from 'graphql-tag'
import Dropdown from 'react-bootstrap/Dropdown'
import { useToast } from './toast'

export default function BookmarkDropdownItem ({ item: { id, meBookmark } }) {
  const toaster = useToast()
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
          },
          optimistic: true
        })
      }
    }
  )
  return (
    <Dropdown.Item
      onClick={async () => {
        try {
          await bookmarkItem({ variables: { id } })
          toaster.success(meBookmark ? 'bookmark removed' : 'bookmark added')
        } catch (err) {
          console.error(err)
          toaster.danger(meBookmark ? 'failed to remove bookmark' : 'failed to bookmark')
        }
      }}
    >
      {meBookmark ? 'remove bookmark' : 'bookmark'}
    </Dropdown.Item>
  )
}
