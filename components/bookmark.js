import { useMutation } from '@apollo/client'
import { gql } from 'graphql-tag'
import Dropdown from 'react-bootstrap/Dropdown'

export default function BookmarkDropdownItem ({ item: { id, meBookmark } }) {
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
      onClick={() => bookmarkItem({ variables: { id } })}
    >
      {meBookmark ? 'remove bookmark' : 'bookmark'}
    </Dropdown.Item>
  )
}
