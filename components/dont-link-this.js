import { gql, useMutation } from '@apollo/client'
import Dropdown from 'react-bootstrap/Dropdown'
import FundError from './fund-error'
import { useShowModal } from './modal'
import { useToast } from './toast'

export default function DontLikeThisDropdownItem ({ id }) {
  const toaster = useToast()
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
          toaster.success('item flagged')
        } catch (error) {
          console.error(error)
          if (error.toString().includes('insufficient funds')) {
            showModal(onClose => {
              return <FundError onClose={onClose} />
            })
          } else {
            toaster.danger('failed to flag item')
          }
        }
      }}
    >
      flag
    </Dropdown.Item>
  )
}
