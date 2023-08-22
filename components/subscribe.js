import { useMutation } from '@apollo/client'
import { gql } from 'graphql-tag'
import Dropdown from 'react-bootstrap/Dropdown'
import { useToast } from './toast'

export default function SubscribeDropdownItem ({ item: { id, meSubscription } }) {
  const dispatchToast = useToast()
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
      onClick={async () => {
        try {
          await subscribeItem({ variables: { id } })
          dispatchToast({ body: meSubscription ? 'Unsubscribe successful!' : 'Subscribe successful!', variant: 'success', autohide: true, delay: 5000 })
        } catch (err) {
          console.error(err)
          dispatchToast({ header: 'Error', body: meSubscription ? 'Unsubscribe failed' : 'Subscribe failed', variant: 'danger', autohide: false })
        }
      }}
    >
      {meSubscription ? 'remove subscription' : 'subscribe'}
    </Dropdown.Item>
  )
}
