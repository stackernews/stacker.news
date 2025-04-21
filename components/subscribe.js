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
          },
          optimistic: true
        })

        const unsubscribed = !subscribeItem.meSubscription
        if (!unsubscribed) return

        const cacheState = cache.extract()
        Object.keys(cacheState)
          .filter(key => key.startsWith('Item:'))
          .forEach(key => {
            cache.modify({
              id: key,
              fields: {
                meSubscription: (existing, { readField }) => {
                  const path = readField('path')
                  return !path || !path.includes(id) ? existing : false
                }
              },
              optimistic: true
            })
          })
      }
    }
  )
  return (
    <Dropdown.Item
      onClick={async () => {
        try {
          await subscribeItem({ variables: { id } })
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
