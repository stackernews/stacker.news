import { gql, useMutation } from '@apollo/client'
import Dropdown from 'react-bootstrap/Dropdown'
import FundError from './fund-error'
import { useShowModal } from './modal'
import { useToast } from './toast'

export default function DontLikeThisDropdownItem ({ id }) {
  const dispatchToast = useToast()
  const showModal = useShowModal()

  const [dontLikeThis] = useMutation(
    gql`
      mutation dontLikeThis($id: ID!) {
        dontLikeThis(id: $id)
      }`, {
      update (cache) {
        cache.modify({
          id: `Item:${id}`,
          fields: {
            meDontLike () {
              return true
            }
          }
        })
      }
    }
  )

  return (
    <Dropdown.Item
      onClick={async () => {
        try {
          await dontLikeThis({
            variables: { id },
            optimisticResponse: { dontLikeThis: true }
          })
          dispatchToast({ body: 'Item flagged successfully!', variant: 'success', autohide: true, delay: 5000 })
        } catch (error) {
          if (error.toString().includes('insufficient funds')) {
            showModal(onClose => {
              return <FundError onClose={onClose} />
            })
          } else {
            dispatchToast({ header: 'Error', body: 'Failed to flag this item', variant: 'danger', autohide: false })
          }
        }
      }}
    >
      flag
    </Dropdown.Item>
  )
}
