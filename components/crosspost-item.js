import useCrossposter from './use-crossposter'
import Dropdown from 'react-bootstrap/Dropdown'
import { ITEM } from '../fragments/items'
import { gql, useQuery, useMutation } from '@apollo/client'
import { normalizeForwards } from '../lib/form'

export default function CrosspostDropdownItem({ item }) {
    // Update createdAt
    const { data } = useQuery(ITEM, { variables: { id: item.id } })

    const [upsertDiscussion] = useMutation(
        gql`
          mutation upsertDiscussion($sub: String, $id: ID, $title: String!, $text: String, $boost: Int, $forward: [ItemForwardInput], $hash: String, $hmac: String, $nEventId: String) {
            upsertDiscussion(sub: $sub, id: $id, title: $title, text: $text, boost: $boost, forward: $forward, hash: $hash, hmac: $hmac, nEventId: $nEventId) {
              id
            }
          }`
      )

    const crossposter = useCrossposter()
    return !item?.nEventId ? (
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
                        const crosspostResult = await crossposter({ ...data.item, id: item.id, createdAt: item.createdAt })
                        const eventId = crosspostResult?.eventId;
                        console.log('eventId', item.boost)
                        if (eventId) {
                            await upsertDiscussion({
                              variables: {
                                sub: item?.subName || sub?.name,
                                id: item?.id,
                                boost: item?.boost ? (Number(item?.boost) >= 25000 ? Number(item?.boost) : undefined) : undefined,
                                nEventId: eventId,
                                title: item?.title
                              }
                            })
                        }
                    }
                } catch (e) {
                    console.error(e)
                }
            }}
        >
            crosspost to nostr
        </Dropdown.Item>
    ) : (
        <Dropdown.Item onClick={() => window.open(`https://nostr.band/${item.nEventId}`, '_blank')}>
            nostr note
        </Dropdown.Item>
    )
}
