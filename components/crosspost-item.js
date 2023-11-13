import useCrossposter from './use-crossposter'
import Dropdown from 'react-bootstrap/Dropdown'
import { ITEM } from '../fragments/items'
import { useRouter } from 'next/router'
import { gql, useQuery, useMutation } from '@apollo/client'

export default function CrosspostDropdownItem ({ item }) {
  const { data } = useQuery(ITEM, { variables: { id: item.id } })
  const router = useRouter()

  const [upsertDiscussion] = useMutation(
    gql`
      mutation upsertDiscussion($sub: String, $id: ID, $title: String!, $text: String, $boost: Int, $forward: [ItemForwardInput], $hash: String, $hmac: String, $noteId: String) {
        upsertDiscussion(sub: $sub, id: $id, title: $title, text: $text, boost: $boost, forward: $forward, hash: $hash, hmac: $hmac, noteId: $noteId) {
          id
        }
      }
    `
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
            throw new Error(`Nostr extension error: ${e.message}`)
          }

          try {
            if (item?.id) {
              const crosspostResult = await crossposter({ ...data.item })
              const eventId = crosspostResult?.eventId
              if (eventId) {
                await upsertDiscussion({
                  variables: {
                    sub: item?.subName,
                    id: item?.id,
                    boost: item?.boost ? (Number(item?.boost) >= 25000 ? Number(item?.boost) : undefined) : undefined,
                    noteId: eventId,
                    title: item?.title
                  }
                })
              }
              await router.push(`/items/${item.id}`)
            }
          } catch (e) {
            console.error(e)
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
