import { createContext, useContext } from 'react'
import { useMutation } from '@apollo/client/react'
import { gql } from 'graphql-tag'
import { MenuItem } from '@/components/ui/menu'
import { useToast } from '@/components/ui/toast'

const SubscribeUserContext = createContext(() => ({
  refetchQueries: []
}))

export const SubscribeUserContextProvider = ({ children, value }) => {
  return (
    <SubscribeUserContext.Provider value={value}>
      {children}
    </SubscribeUserContext.Provider>
  )
}

export const useSubscribeUserContext = () => useContext(SubscribeUserContext)

export default function SubscribeUserDropdownItem ({ user, target = 'posts' }) {
  const isPosts = target === 'posts'
  const mutation = isPosts ? 'subscribeUserPosts' : 'subscribeUserComments'
  const userField = isPosts ? 'meSubscriptionPosts' : 'meSubscriptionComments'
  const toaster = useToast()
  const { id, [userField]: meSubscription } = user
  const { refetchQueries } = useSubscribeUserContext()
  const [subscribeUser] = useMutation(
    gql`
      mutation ${mutation}($id: ID!) {
        ${mutation}(id: $id) {
          ${userField}
        }
      }`, {
      refetchQueries,
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
    <MenuItem
      onClick={async () => {
        try {
          await subscribeUser({ variables: { id } })
          toaster.success(meSubscription ? 'unsubscribed' : 'subscribed')
        } catch (err) {
          console.error(err)
          toaster.danger(err.message ?? (meSubscription ? 'failed to unsubscribe' : 'failed to subscribe'))
        }
      }}
    >
      {meSubscription
        ? `unsubscribe from ${isPosts ? 'posts' : 'comments'}`
        : `subscribe to ${isPosts ? 'posts' : 'comments'}`}
    </MenuItem>
  )
}
