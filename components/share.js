import Dropdown from 'react-bootstrap/Dropdown'
import ShareIcon from '@/svgs/share-fill.svg'
import copy from 'clipboard-copy'
import useCrossposter from './use-crossposter'
import { useMe } from './me'
import { useToast } from './toast'
import { SSR } from '@/lib/constants'
import { commentSubTreeRootId } from '@/lib/item'
import { useRouter } from 'next/router'

const referrurl = (ipath, me) => {
  const referral = me && !me.privates?.noReferralLinks
  const path = `${ipath}${referral ? `/r/${me.name}` : ''}`
  if (!SSR) {
    return `${window.location.protocol}//${window.location.host}${path}`
  }
  return `${process.env.NEXT_PUBLIC_URL}${path}`
}

async function share (title, url, toaster) {
  // only use navigator.share on touch devices
  try {
    if (navigator?.share &&
      (navigator?.maxTouchPoints > 0 || navigator?.msMaxTouchPoints > 0)) {
      await navigator.share({ title, text: '', url })
      toaster.success('link shared')
    } else {
      await copy(url)
      toaster.success('link copied')
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return
    }

    toaster.danger('failed to copy link')
  }
}

export default function Share ({ path, title = '', className = '' }) {
  const { me } = useMe()
  const toaster = useToast()
  const url = referrurl(path, me)

  return (
    <div className='ms-auto pointer d-flex align-items-center'>
      <ShareIcon
        width={20} height={20}
        className={`mx-2 fill-grey theme ${className}`}
        onClick={async () => {
          await share(title, url, toaster)
        }}
      />
    </div>
  )
}

export function CopyLinkDropdownItem ({ item }) {
  const { me } = useMe()
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
        await share(item.title || '', url, toaster)
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
