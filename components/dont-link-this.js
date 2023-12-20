import { gql, useMutation } from '@apollo/client'
import Dropdown from 'react-bootstrap/Dropdown'
import { useShowModal } from './modal'
import { useToast } from './toast'
import ItemAct from './item-act'
import AccordianItem from './accordian-item'

export default function DontLikeThisDropdownItem ({ id }) {
  const toaster = useToast()
  const showModal = useShowModal()

  const [dontLikeThis] = useMutation(
    gql`
      mutation dontLikeThis($id: ID!, $sats: Int, $hash: String, $hmac: String) {
        dontLikeThis(id: $id, sats: $sats, hash: $hash, hmac: $hmac)
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
          showModal(onClose =>
            <ItemAct
              onClose={() => {
                onClose()
                toaster.success('item downzapped')
              }} itemId={id} act={dontLikeThis} down
            >
              <AccordianItem
                header='what is a downzap?' body={
                  <ul>
                    <li>downzaps are just like zaps but cause items to lose ranking position</li>
                    <li>downzaps also reduce trust between you and whoever zaps it so you'll see less of what they zap in the future</li>
                    <li>all sats from downzaps go to rewards</li>
                  </ul>
              }
              />
            </ItemAct>)
        } catch (error) {
          toaster.danger('failed to downzap item')
        }
      }}
    >
      <span className='text-danger'>downzap</span>
    </Dropdown.Item>
  )
}
