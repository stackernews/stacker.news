import { useMutation } from '@apollo/client'
import { gql } from 'graphql-tag'
import Dropdown from 'react-bootstrap/Dropdown'
import { useToast } from './toast'

export default function SubscribeUserDropdownItem ({ user: { id, meSubscription } }) {
  const toaster = useToast()
  const [subscribeUser] = useMutation(
    gql`
      mutation subscribeUser($id: ID!) {
        subscribeUser(id: $id) {
          meSubscription
        }
      }`, {
      update (cache, { data: { subscribeUser } }) {
        cache.modify({
          id: `User:${id}`,
          fields: {
            meSubscription: () => subscribeUser.meSubscription
          }
        })
      }
    }
  )
  return (
    <Dropdown.Item
      onClick={async () => {
        try {
          await subscribeUser({ variables: { id } })
          toaster.success(meSubscription ? 'unsubscribed' : 'subscribed')
        } catch (err) {
          console.error(err)
          toaster.danger(meSubscription ? 'failed to unsubscribe' : 'failed to subscribe')
        }
      }}
    >
      {meSubscription ? 'remove subscription' : 'subscribe'}
    </Dropdown.Item>
  )
}
