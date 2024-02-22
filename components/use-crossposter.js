import { useCallback } from 'react'
import { useToast } from './toast'
import { Button } from 'react-bootstrap'
import { DEFAULT_CROSSPOSTING_RELAYS, crosspost, callWithTimeout } from '../lib/nostr'
import { gql, useMutation, useQuery, useLazyQuery } from '@apollo/client'
import { SETTINGS } from '../fragments/users'
import { ITEM_FULL_FIELDS, POLL_FIELDS } from '../fragments/items'

async function discussionToEvent (item) {
  const createdAt = Math.floor(Date.now() / 1000)

  return {
    created_at: createdAt,
    kind: 30023,
    content: item.text,
    tags: [
      ['d', item.id.toString()],
      ['title', item.title],
      ['published_at', createdAt.toString()]
    ]
  }
}

async function linkToEvent (item) {
  const createdAt = Math.floor(Date.now() / 1000)

  return {
    created_at: createdAt,
    kind: 1,
    content: `${item.title} \n ${item.url}`,
    tags: []
  }
}

async function pollToEvent (item) {
  const createdAt = Math.floor(Date.now() / 1000)

  const expiresAt = createdAt + 86400

  return {
    created_at: createdAt,
    kind: 1,
    content: item.text,
    tags: [
      ['poll', 'single', expiresAt.toString(), item.title, ...item.poll.options.map(op => op?.option.toString())]
    ]
  }
}

async function bountyToEvent (item) {
  const createdAt = Math.floor(Date.now() / 1000)

  return {
    created_at: createdAt,
    kind: 30402,
    content: item.text,
    tags: [
      ['d', item.id.toString()],
      ['title', item.title],
      ['location', `https://stacker.news/items/${item.id}`],
      ['price', item.bounty.toString(), 'SATS'],
      ['t', 'bounty'],
      ['published_at', createdAt.toString()]
    ]
  }
}

export default function useCrossposter () {
  const toaster = useToast()
  const { data } = useQuery(SETTINGS)
  const userRelays = data?.settings?.privates?.nostrRelays || []
  const relays = [...DEFAULT_CROSSPOSTING_RELAYS, ...userRelays]

  const [fetchItem] = useLazyQuery(
    gql`
      ${ITEM_FULL_FIELDS}
      ${POLL_FIELDS}
      query Item($id: ID!) {
        item(id: $id) {
          ...ItemFullFields
          ...PollFields
        }
      }`, {
      fetchPolicy: 'no-cache'
    }
  )

  const [updateNoteId] = useMutation(
    gql`
      mutation updateNoteId($id: ID!, $noteId: String!) {
        updateNoteId(id: $id, noteId: $noteId) {
          id
          noteId
        }
      }`
  )

  const relayError = (failedRelays) => {
    return new Promise(resolve => {
      const handleSkip = () => {
        resolve('skip')

        removeToast()
      }

      const removeToast = toaster.danger(
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
            variant='link' onClick={handleSkip}
          >Skip
          </Button>
        </>,
        {
          onCancel: () => handleSkip()
        }
      )
    })
  }

  const crosspostError = (errorMessage) => {
    return toaster.danger(`Error crossposting: ${errorMessage}`)
  }

  async function handleEventCreation (item) {
    const determineItemType = (item) => {
      const typeMap = {
        url: 'link',
        bounty: 'bounty',
        pollCost: 'poll'
      }

      for (const [key, type] of Object.entries(typeMap)) {
        if (item[key]) {
          return type
        }
      }

      // Default
      return 'discussion'
    }

    const itemType = determineItemType(item)

    switch (itemType) {
      case 'discussion':
        return await discussionToEvent(item)
      case 'link':
        return await linkToEvent(item)
      case 'bounty':
        return await bountyToEvent(item)
      case 'poll':
        return await pollToEvent(item)
      default:
        return crosspostError('Unknown item type')
    }
  }

  const fetchItemData = async (itemId) => {
    try {
      const { data } = await fetchItem({ variables: { id: itemId } })

      return data?.item
    } catch (e) {
      console.error(e)
      return null
    }
  }

  const crosspostItem = async item => {
    let failedRelays
    let allSuccessful = false
    let noteId

    const event = await handleEventCreation(item)
    if (!event) return { allSuccessful, noteId }

    do {
      try {
        const result = await crosspost(event, failedRelays || relays)

        if (result.error) {
          failedRelays = []
          throw new Error(result.error)
        }

        noteId = result.noteId
        failedRelays = result?.failedRelays?.map(relayObj => relayObj.relay) || []

        if (failedRelays.length > 0) {
          const userAction = await relayError(failedRelays)

          if (userAction === 'skip') {
            toaster.success('Skipped failed relays.')
            // wait 2 seconds then break
            await new Promise(resolve => setTimeout(resolve, 2000))
            break
          }
        } else {
          allSuccessful = true
        }
      } catch (error) {
        await crosspostError(error.message)

        // wait 2 seconds to show error then break
        await new Promise(resolve => setTimeout(resolve, 2000))
        return { allSuccessful, noteId }
      }
    } while (failedRelays.length > 0)

    return { allSuccessful, noteId }
  }

  const handleCrosspost = useCallback(async (itemId) => {
    try {
      const pubkey = await callWithTimeout(() => window.nostr.getPublicKey(), 10000)
      if (!pubkey) throw new Error('failed to get pubkey')
    } catch (e) {
      throw new Error(`Nostr extension error: ${e.message}`)
    }

    let noteId

    try {
      if (itemId) {
        const item = await fetchItemData(itemId)

        const crosspostResult = await crosspostItem(item)
        noteId = crosspostResult?.noteId
        if (noteId) {
          await updateNoteId({
            variables: {
              id: itemId,
              noteId
            }
          })
        }
      }
    } catch (e) {
      console.error(e)
      await crosspostError(e.message)
    }
  }, [updateNoteId, relays, toaster])

  return handleCrosspost
}
