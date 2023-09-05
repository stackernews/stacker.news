import { gql, useMutation } from '@apollo/client'
import Dropdown from 'react-bootstrap/Dropdown'
import { useShowModal } from './modal'
import { useToast } from './toast'
import { InvoiceModal, payOrLoginError } from './invoice'
import { DONT_LIKE_THIS_COST } from '../lib/constants'

export default function DontLikeThisDropdownItem ({ id }) {
  const toaster = useToast()
  const showModal = useShowModal()

  const [dontLikeThis] = useMutation(
    gql`
      mutation dontLikeThis($id: ID!, $hash: String, $hmac: String) {
        dontLikeThis(id: $id, hash: $hash, hmac: $hmac)
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
          if (payOrLoginError(error)) {
            showModal(onClose => {
              return (
                <InvoiceModal
                  amount={DONT_LIKE_THIS_COST}
                  onPayment={async ({ hash, hmac }) => {
                    await dontLikeThis({ variables: { id, hash, hmac } })
                    toaster.success('item flagged')
                  }}
                />
              )
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
