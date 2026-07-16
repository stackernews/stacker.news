import { createContext, useContext } from 'react'
import { useMutation } from '@apollo/client/react'
import { gql } from 'graphql-tag'
import Menu from '@/components/ui/menu'
import { useToast } from '@/components/ui/toast'

const MuteUserContext = createContext(() => ({
  refetchQueries: []
}))

export const MuteUserContextProvider = ({ children, value }) => {
  return (
    <MuteUserContext.Provider value={value}>
      {children}
    </MuteUserContext.Provider>
  )
}

export const useMuteUserContext = () => useContext(MuteUserContext)

export default function MuteDropdownItem ({ user: { name, id, meMute } }) {
  const toaster = useToast()
  const { refetchQueries } = useMuteUserContext()
  const [toggleMute] = useMutation(
    gql`
      mutation toggleMute($id: ID!) {
        toggleMute(id: $id) {
          meMute
        }
      }`, {
      refetchQueries,
      update (cache, { data: { toggleMute } }) {
        cache.modify({
          id: `User:${id}`,
          fields: {
            meMute: () => toggleMute.meMute
          }
        })
      }
    }
  )
  return (
    <Menu.Item
      onClick={async () => {
        try {
          await toggleMute({ variables: { id } })
          toaster.success(`${meMute ? 'un' : ''}muted ${name}`)
        } catch (err) {
          console.error(err)
          toaster.danger(err.message ?? `failed to ${meMute ? 'un' : ''}mute ${name}`)
        }
      }}
    >
      {`${meMute ? 'un' : ''}mute ${name}`}
    </Menu.Item>
  )
}
