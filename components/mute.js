import { useMutation } from '@apollo/client'
import { gql } from 'graphql-tag'
import Dropdown from 'react-bootstrap/Dropdown'
import { useToast } from './toast'

export default function MuteDropdownItem ({ user: { name, id, meMute } }) {
  const toaster = useToast()
  const [toggleMute] = useMutation(
    gql`
      mutation toggleMute($id: ID!) {
        toggleMute(id: $id) {
          meMute
        }
      }`, {
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
    <Dropdown.Item
      onClick={async () => {
        try {
          await toggleMute({ variables: { id } })
          toaster.success(`${meMute ? 'un' : ''}muted ${name}`)
        } catch (err) {
          console.error(err)
          toaster.danger(`failed to ${meMute ? 'un' : ''}mute ${name}`)
        }
      }}
    >
      {`${meMute ? 'un' : ''}mute ${name}`}
    </Dropdown.Item>
  )
}
