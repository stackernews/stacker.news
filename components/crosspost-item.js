import useCrossposter from './use-crossposter'
import Dropdown from 'react-bootstrap/Dropdown'
import { ITEM } from '../fragments/items'
import { gql, useQuery, useMutation } from '@apollo/client'
import { useToast } from './toast'

export default function CrosspostDropdownItem ({ item }) {
  const { data } = useQuery(ITEM, { variables: { id: item.id } })
  const toaster = useToast()

  const [upsertNoteId] = useMutation(
    gql`
      mutation upsertNoteId($id: ID!, $noteId: String!) {
        upsertNoteId(id: $id, noteId: $noteId) {
          id
          noteId
        }
      }`
  )

  const crossposter = useCrossposter()

  return !item?.noteId
    ? (
      <Dropdown.Item
        onClick={async () => {
          try {
            if (!(await window.nostr.getPublicKey())) {
              throw new Error('not available')
            }
          } catch (e) {
            toaster.danger(`Nostr extension error: ${e.message}`)
            return
          }
          try {
            if (item?.id) {
              const crosspostResult = await crossposter({ ...data.item })
              const noteId = crosspostResult?.noteId
              if (noteId) {
                await upsertNoteId({
                  variables: {
                    id: item.id,
                    noteId
                  }
                })
              }
              toaster.success('Crosspost successful')
            } else {
              toaster.warning('Item ID not available')
            }
          } catch (e) {
            console.error(e)
            toaster.danger('Crosspost failed')
          }
        }}
      >
        crosspost to nostr
      </Dropdown.Item>
      )
    : (
      <Dropdown.Item onClick={() => window.open(`https://nostr.band/${item.noteId}`, '_blank')}>
        nostr note
      </Dropdown.Item>
      )
}
