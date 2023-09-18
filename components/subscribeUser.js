import { useMutation } from '@apollo/client'
import { gql } from 'graphql-tag'
import Dropdown from 'react-bootstrap/Dropdown'
import { useToast } from './toast'

export default function SubscribeUserDropdownItem ({ user, target = 'posts' }) {
  const isPosts = target === 'posts'
  const mutation = isPosts ? 'subscribeUserPosts' : 'subscribeUserComments'
  const userField = isPosts ? 'meSubscriptionPosts' : 'meSubscriptionComments'
  const toaster = useToast()
  const { id, [userField]: meSubscription } = user
  const [subscribeUser] = useMutation(
    gql`
      mutation ${mutation}($id: ID!) {
        ${mutation}(id: $id) {
          ${userField}
        }
      }`, {
      update (cache, { data: { [mutation]: subscribeUser } }) {
        cache.modify({
          id: `User:${id}`,
          fields: {
            [userField]: () => subscribeUser[userField]
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
      {meSubscription
        ? `unsubscribe from ${isPosts ? 'posts' : 'comments'}`
        : `subscribe to ${isPosts ? 'posts' : 'comments'}`}
    </Dropdown.Item>
  )
}
