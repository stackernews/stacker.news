import { useCallback } from 'react'
import { useToast } from './toast'
import { Button } from 'react-bootstrap'
import { DEFAULT_CROSSPOSTING_RELAYS, crosspost } from '../lib/nostr'
import { gql, useMutation, useQuery } from '@apollo/client'
import { SETTINGS } from '../fragments/users'
import { callWithTimeout } from '../lib/nostr'

function determineItemType (item) {
  console.log('item in determineItemType', item)
  const typeMap = {
    company: 'job',
    url: 'link',
    bounty: 'bounty',
    options: 'poll'
  }

  for (const [key, type] of Object.entries(typeMap)) {
    console.log('key', key)
    console.log('type', type)
    if (item[key]) {
      return type
    }
  }

  // Default
  return 'discussion'
}

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
  console.log('item in linkToEvent', item)

  return {
    created_at: createdAt,
    kind: 1,
    content: `${item.title} \n ${item.url}`,
    tags: []
  }
}

async function pollToEvent (item) {
  console.log('item in pollToEvent', item)
  const createdAt = Math.floor(Date.now() / 1000)

  const expiresAt = createdAt + 86400

  return {
    created_at: createdAt,
    kind: 1,
    content: item.text,
    tags: [
      ['poll', 'single', expiresAt.toString(), item.title, ...item.options.map(op => op.toString())]
    ]
  }
}

async function bountyToEvent (item) {
  console.log('item in bountyToEvent', item)
  const createdAt = Math.floor(Date.now() / 1000)

  return {
    created_at: createdAt,
    kind: 30402,
    content: item.text,
    tags: [
      ['d', item.id.toString()],
      ['title', item.title],
      ['location', `https://stacker.news/items/${item.id}`],
      ['price', item.bounty.toString(), "SATS"],
      ['t', 'bounty'],
      ['published_at', createdAt.toString()]
    ]
  }
}

async function jobToEvent (item) {
  const createdAt = Math.floor(Date.now() / 1000)

  return {
    created_at: createdAt,
    kind: 30402,
    content: item.text,
    tags: [
      ['d', item.id.toString()],
      ['title', item.title],
      ['location', item?.location || 'remote'],
      ['company', item.company],
      ['t', 'job'],
      ['published_at', createdAt.toString()]
    ]
  }
}

export default function useCrossposter () {
  const toaster = useToast()
  const { data } = useQuery(SETTINGS)
  const userRelays = data?.settings?.privates?.nostrRelays || []
  const relays = [...DEFAULT_CROSSPOSTING_RELAYS, ...userRelays]

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
      const removeToast = toast.danger(
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

  const handleEventCreation = async (itemType, item) => {
    switch (itemType) {
      case 'discussion':
        return await discussionToEvent(item)
      case 'link':
        return await linkToEvent(item)
      case 'bounty':
        return await bountyToEvent(item)
      case 'poll':
        return await pollToEvent(item)
      case 'job':
        return await jobToEvent(item)
      default:
        return null // handle error
    }
  }

  const crosspostItem = async item => {
    let failedRelays;
    let allSuccessful = false;
    let noteId;

    do {
      const itemType = determineItemType(item);
      const event = await handleEventCreation(itemType, item);
      if (!event) break; // Break if event creation fails

      const result = await crosspost(event, failedRelays || relays);

      if (result?.error) {
        toaster.danger('Error crossposting to Nostr', result.error?.message);
        // wait 2 seconds then break
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { allSuccessful, noteId };
      }

      noteId = result.noteId;
      failedRelays = result?.failedRelays.map(relayObj => relayObj.relay);

      if (failedRelays.length > 0) {
        const userAction = await relayError(failedRelays);
        if (userAction === 'skip') {
          toaster.success('Skipped failed relays.');
          // wait 2 seconds then break
          await new Promise(resolve => setTimeout(resolve, 2000));
          break;
        }
      } else {
        allSuccessful = true;
      }
    } while (failedRelays.length > 0);

    return { allSuccessful, noteId };
  };

  const handleCrosspost = useCallback(async (values, itemId) => {
    console.log('values', values)
    console.log('itemId', itemId)
    try {
      const pubkey = await callWithTimeout(() => window.nostr.getPublicKey(), 10000)
      if (!pubkey) throw new Error('failed to get pubkey')
    } catch (e) {
      throw new Error(`Nostr extension error: ${e.message}`)
    }

    let noteId;

    try {
      if (itemId) {
        const crosspostResult = await crosspostItem({ ...values, id: itemId })
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
      toaster.danger('Error crossposting to Nostr', e.message)
    }

    if (noteId) {
      await updateNoteId({
        variables: {
          id: itemId,
          noteId
        }
      })
    }
  }, [updateNoteId, relays, toaster])

  return handleCrosspost
}
