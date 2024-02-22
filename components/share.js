import Dropdown from 'react-bootstrap/Dropdown'
import ShareIcon from '../svgs/share-fill.svg'
import copy from 'clipboard-copy'
import useCrossposter from './use-crossposter'
import { useMe } from './me'
import { useToast } from './toast'
import { SSR } from '../lib/constants'
import { commentSubTreeRootId } from '../lib/item'
import { useRouter } from 'next/router'

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
  const router = useRouter()
  let url = referrurl(`/items/${item.id}`, me)

  // if this is a comment and we're not directly on the comment page
  // link to the comment in context
  if (item.parentId && !router.asPath.includes(`/items/${item.id}`)) {
    const rootId = commentSubTreeRootId(item)
    url = referrurl(`/items/${rootId}`, me) + `?commentId=${item.id}`
  }

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

  const handleCrosspostClick = async () => {
    try {
      await crossposter(item.id)
    } catch (e) {
      console.error(e)
      toaster.danger('Crosspost failed')
    }
  }

  return (
    <Dropdown.Item onClick={handleCrosspostClick}>
      crosspost to nostr
    </Dropdown.Item>
  )
}
