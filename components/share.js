import Dropdown from 'react-bootstrap/Dropdown'
import ShareIcon from '../svgs/share-fill.svg'
import copy from 'clipboard-copy'
import useCrossposter from './use-crossposter'
import { useMutation, gql } from '@apollo/client'
import { useMe } from './me'
import { useToast } from './toast'
import { SSR } from '../lib/constants'

const getShareUrl = (item, me) => {
  const path = `/items/${item?.id}${me ? `/r/${me.name}` : ''}`
  if (!SSR) {
    return `${window.location.protocol}//${window.location.host}${path}`
  }
  return `https://stacker.news${path}`
}

export default function Share ({ item }) {
  const me = useMe()
  const crossposter = useCrossposter()
  const toaster = useToast()
  const url = getShareUrl(item, me)

  const mine = item?.user?.id === me?.id

  const [updateNoteId] = useMutation(
    gql`
      mutation updateNoteId($id: ID!, $noteId: String!) {
        updateNoteId(id: $id, noteId: $noteId) {
          id
          noteId
        }
      }`
  )

  return !SSR && navigator?.share
    ? (
      <div className='ms-auto pointer d-flex align-items-center'>
        <ShareIcon
          width={20} height={20}
          className='mx-2 fill-grey theme'
          onClick={async () => {
            try {
              await navigator.share({
                title: item.title || '',
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
          <ShareIcon width={20} height={20} className='mx-2 fill-grey theme' />
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
          {mine && !item?.noteId && (
            <Dropdown.Item
              onClick={async () => {
                try {
                  if (!(await window.nostr?.getPublicKey())) {
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
          )}
        </Dropdown.Menu>
      </Dropdown>)
}

export function CopyLinkDropdownItem ({ item }) {
  const me = useMe()
  const toaster = useToast()
  const url = getShareUrl(item, me)
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
