import { useMutation } from '@apollo/client'
import { gql } from 'graphql-tag'
import Dropdown from 'react-bootstrap/Dropdown'
import { useToast } from './toast'

export default function SubscribeDropdownItem ({ item: { id, meSubscription } }) {
  const toaster = useToast()
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
          toaster.success(meSubscription ? 'removed subscription' : 'subscribed')
        } catch (err) {
          console.error(err)
          toaster.danger(meSubscription ? 'failed to remove subscription' : 'failed to subscribe')
        }
      }}
    >
      {meSubscription ? 'remove subscription' : 'subscribe'}
    </Dropdown.Item>
  )
}

export function UnsubscribeDropdownItem ({ item: { id, meUnsubscription } }) {
  const toaster = useToast()
  const [unsubscribeItem] = useMutation(
    gql`
      mutation unsubscribeItem($id: ID!) {
        unsubscribeItem(id: $id) {
          meUnsubscription
        }
      }`, {
      update (cache, { data: { unsubscribeItem } }) {
        cache.modify({
          id: `Item:${id}`,
          fields: {
            meUnsubscription: () => unsubscribeItem.meUnsubscription
          }
        })
      }
    }
  )
  return (
    <Dropdown.Item
      onClick={async () => {
        try {
          await unsubscribeItem({ variables: { id } })
          toaster.success(meUnsubscription ? 'removed unsubscription' : 'unsubscribed')
        } catch (err) {
          console.error(err)
          toaster.danger(meUnsubscription ? 'failed to remove unsubscription' : 'failed to unsubscribe')
        }
      }}
    >
      {meUnsubscription ? 'remove unsubscription' : 'unsubscribe'}
    </Dropdown.Item>
  )
}
