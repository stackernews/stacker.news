import { useCallback } from 'react'
import { useToast } from './toast'
import { Button } from 'react-bootstrap'
import { DEFAULT_CROSSPOSTING_RELAYS, crosspost, callWithTimeout } from '@/lib/nostr'
import { gql, useMutation, useQuery, useLazyQuery } from '@apollo/client'
import { SETTINGS } from '@/fragments/users'
import { ITEM_FULL_FIELDS, POLL_FIELDS } from '@/fragments/items'
import { bech32 } from 'bech32'

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

  let contentField
  if (item.text) {
    contentField = `${item.title}\n${item.url}\n\n${item.text}`
  } else {
    contentField = `${item.title}\n${item.url}`
  }

  return {
    created_at: createdAt,
    kind: 1,
    content: contentField,
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

async function replyToEvent (item, fetchItemData) {
  const createdAt = Math.floor(Date.now() / 1000)
  let replyTo;

  if (item.root?.id) {
    const replyToItem = await fetchItemData(item.root.id)

    if (replyToItem) {
      replyTo = replyToItem.noteId
    }
  }

  if (!replyTo) {
    throw new Error('Failed to get parent item')
  }

  if (replyTo.includes('naddr')) {
    const { kind, pubkey, dTag } = decodeNaddr(replyTo)
    return {
      created_at: createdAt,
      kind: 1,
      content: item.text,
      tags: [
        ['a', `${kind}:${pubkey}:${dTag}`],
      ]
    }
  } else {
    return {
      created_at: createdAt,
      kind: 1,
      content: item.text,
      tags: [
        ['e', replyTo],
      ]
    }
  }
}

function decodeNaddr(address) {
  // Decode the bech32 address
  const { prefix, words } = bech32.decode(address);

  // Convert from words to bytes
  const data = Buffer.from(bech32.fromWords(words));

  // Initialize pointers and result storage
  let pointer = 0;
  const result = {
    pubkey: null,
    dTag: null,
    kind: null, // Adding kind field here
  };

  // Loop through data to parse TLV structures
  while (pointer < data.length) {
    const type = data[pointer++];
    const length = data[pointer++];

    if (type === 2 && length === 32) {
      // Type 2 is the pubkey for naddr
      result.pubkey = data.slice(pointer, pointer + length).toString("hex");
    } else if (type === 0 && length > 0) {
      // Type 0 is the 'd' tag for naddr, ensuring there's content to decode
      result.dTag = data.slice(pointer, pointer + length).toString("utf8");
    } else if (type === 3 && length === 4) {
      // Type 3 is the kind for naddr, which is a 32-bit unsigned integer
      result.kind = data.readUInt32BE(pointer);
    }

    // Move the pointer by the length of the current value
    pointer += length;
  }

  return result;
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

  async function handleEventCreation (item, fetchItemData) {
    const determineItemType = (item) => {
      const typeMap = {
        url: 'link',
        bounty: 'bounty',
        pollCost: 'poll',
        parentId: 'reply'
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
      case 'reply':
        return await replyToEvent(item, fetchItemData)
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

  const crosspostItem = async (item, fetchItemData) => {
    let failedRelays
    let allSuccessful = false
    let noteId

    const event = await handleEventCreation(item, fetchItemData)
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

        const crosspostResult = await crosspostItem(item, fetchItemData)
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
