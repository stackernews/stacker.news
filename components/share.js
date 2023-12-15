import Dropdown from 'react-bootstrap/Dropdown'
import ShareIcon from '../svgs/share-fill.svg'
import copy from 'clipboard-copy'
import useCrossposter from './use-crossposter'
import { useMutation, gql } from '@apollo/client'
import { useMe } from './me'
import { useToast } from './toast'
import { SSR } from '../lib/constants'
import { callWithTimeout } from '../lib/nostr'

const referrurl = (ipath, me) => {
  const path = `${ipath}${me ? `/r/${me.name}` : ''}`
  if (!SSR) {
    return `${window.location.protocol}//${window.location.host}${path}`
  }
  return `https://stacker.news${path}`
}

export default function Share ({ path, title, className = '' }) {
  const me = useMe()
  const toaster = useToast()
  const url = referrurl(path, me)

  return !SSR && navigator?.share
    ? (
      <div className='ms-auto pointer d-flex align-items-center'>
        <ShareIcon
          width={20} height={20}
          className={`mx-2 fill-grey theme ${className}`}
          onClick={async () => {
            try {
              await navigator.share({
                title: title || '',
                text: '',
                url
              })
              toaster.success('link shared')
            } catch (err) {
              console.error(err)
            }
          }}
        />
      </div>)
    : (
      <Dropdown align='end' className='ms-auto pointer  d-flex align-items-center' as='span'>
        <Dropdown.Toggle variant='success' id='dropdown-basic' as='a'>
          <ShareIcon width={20} height={20} className={`mx-2 fill-grey theme ${className}`} />
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item
            onClick={async () => {
              try {
                await copy(url)
                toaster.success('link copied')
              } catch (err) {
                console.error(err)
                toaster.danger('failed to copy link')
              }
            }}
          >
            copy link
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>)
}

export function CopyLinkDropdownItem ({ item }) {
  const me = useMe()
  const toaster = useToast()
  const url = referrurl(`/items/${item.id}`, me)
  return (
    <Dropdown.Item
      onClick={async () => {
        try {
          if (navigator.share) {
            await navigator.share({
              title: item.title || '',
              text: '',
              url
            })
          } else {
            await copy(url)
          }
          toaster.success('link copied')
        } catch (err) {
          console.error(err)
          toaster.danger('failed to copy link')
        }
      }}
    >
      copy link
    </Dropdown.Item>
  )
}

export function CrosspostDropdownItem ({ item }) {
  const crossposter = useCrossposter()
  const toaster = useToast()

  const [updateNoteId] = useMutation(
    gql`
      mutation updateNoteId($id: ID!, $noteId: String!) {
        updateNoteId(id: $id, noteId: $noteId) {
          id
          noteId
        }
      }`
  )

  return (
    <Dropdown.Item
      onClick={async () => {
        try {
          const pubkey = await callWithTimeout(() => window.nostr.getPublicKey(), 5000)
          if (!pubkey) {
            throw new Error('not available')
          }
        } catch (e) {
          toaster.danger(`Nostr extension error: ${e.message}`)
          return
        }
        try {
          if (item?.id) {
            const crosspostResult = await crossposter({ ...item })
            const noteId = crosspostResult?.noteId
            if (noteId) {
              await updateNoteId({
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
}
