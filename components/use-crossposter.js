import { useCallback } from 'react'
import { useToast } from './toast'
import { Button } from 'react-bootstrap'
import { DEFAULT_CROSSPOSTING_RELAYS, crosspost } from '../lib/nostr'
import { useQuery } from '@apollo/client'
import { SETTINGS } from '../fragments/users'

async function discussionToEvent (item) {
  const pubkey = await window.nostr.getPublicKey()
  const createdAt = Math.floor(Date.now() / 1000)

  return {
    created_at: createdAt,
    kind: 30023,
    content: item.text,
    tags: [
      ['d', `https://stacker.news/items/${item.id}`],
      ['a', `30023:${pubkey}:https://stacker.news/items/${item.id}`, 'wss://relay.nostr.band'],
      ['title', item.title],
      ['published_at', createdAt.toString()]
    ]
  }
}

export default function useCrossposter () {
  const toast = useToast()
  const { data } = useQuery(SETTINGS)
  const relays = [...DEFAULT_CROSSPOSTING_RELAYS, ...(data?.settings?.nostRelays || [])]

  const relayError = (failedRelays) => {
    return new Promise(resolve => {
      const { removeToast } = toast.danger(
        <>
          Crossposting failed for {failedRelays.join(', ')} <br />
          <Button
            variant='link' onClick={() => {
              resolve('retry')
              setTimeout(() => {
                removeToast()
              }, 1000)
            }}
          >Retry
          </Button>
          {' | '}
          <Button
            variant='link' onClick={() => resolve('skip')}
          >Skip
          </Button>
        </>,
        () => resolve('skip') // will skip if user closes the toast
      )
    })
  }

  return useCallback(async item => {
    let failedRelays
    let allSuccessful = false

    do {
      // XXX we only use discussions right now
      const event = await discussionToEvent(item)
      const result = await crosspost(event, failedRelays || relays)

      failedRelays = result.failedRelays.map(relayObj => relayObj.relay)

      if (failedRelays.length > 0) {
        const userAction = await relayError(failedRelays)

        if (userAction === 'skip') {
          toast.success('Skipped failed relays.')
          break
        }
      } else {
        allSuccessful = true
      }
    } while (failedRelays.length > 0)

    return { allSuccessful }
  }, [relays, toast])
}
