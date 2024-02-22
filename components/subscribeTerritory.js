import { useMutation } from '@apollo/client'
import { gql } from 'graphql-tag'
import Dropdown from 'react-bootstrap/Dropdown'
import { useToast } from './toast'

export default function SubscribeTerritoryDropdownItem ({ sub: { name, meSubscription } }) {
  const toaster = useToast()
  const [subscribeItem] = useMutation(
    gql`
      mutation subscribeTerritory($name: String!) {
        subscribeTerritory(name: $name) {
          name
          meSubscription
        }
      }`, {
      update (cache, { data: { subscribeTerritory } }) {
        cache.modify({
          id: `Sub:{"name":"${name}"}`,
          fields: {
            meSubscription: () => subscribeTerritory.meSubscription
          }
        })
      }
    }
  )
  return (
    <Dropdown.Item
      onClick={async () => {
        try {
          await subscribeItem({ variables: { name } })
          toaster.success(meSubscription ? 'unsubscribed' : 'subscribed')
        } catch (err) {
          console.error(err)
          toaster.danger(meSubscription ? 'failed to unsubscribe' : 'failed to subscribe')
        }
      }}
    >
      {meSubscription ? `unsubscribe from ~${name}` : `subscribe to ~${name}`}
    </Dropdown.Item>
  )
}
