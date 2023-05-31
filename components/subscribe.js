import { useMutation } from '@apollo/client'
import { gql } from 'apollo-server-micro'
import { Dropdown } from 'react-bootstrap'

export default function SubscribeDropdownItem ({ item: { id, meSubscription } }) {
  const [subscribeItem] = useMutation(
    gql`
      mutation subscribeItem($id: ID!) {
        subscribeItem(id: $id) {
          meSubscription
        }
      }`, {
      update (cache, { data: { subscribeItem } }) {
        cache.modify({
          id: `Item:${id}`,
          fields: {
            meSubscription: () => subscribeItem.meSubscription
          }
        })
      }
    }
  )
  return (
    <Dropdown.Item
      onClick={() => subscribeItem({ variables: { id } })}
    >
      {meSubscription ? 'remove subscription' : 'subscribe'}
    </Dropdown.Item>
  )
}
