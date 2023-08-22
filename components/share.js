import Dropdown from 'react-bootstrap/Dropdown'
import ShareIcon from '../svgs/share-fill.svg'
import copy from 'clipboard-copy'
import { useMe } from './me'
import { useToast } from './toast'

export default function Share ({ item }) {
  const me = useMe()
  const dispatchToast = useToast()
  const url = `https://stacker.news/items/${item.id}${me ? `/r/${me.name}` : ''}`

  return typeof window !== 'undefined' && navigator?.share
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
              dispatchToast({ body: 'Link shared!', variant: 'success', autohide: true, delay: 5000 })
            } catch (err) {
              console.error(err)
              dispatchToast({ header: 'Error', body: 'Failed to share', variant: 'danger', autohide: false })
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
                dispatchToast({ body: 'Link copied!', variant: 'success', autohide: true, delay: 5000 })
              } catch (err) {
                console.error(err)
                dispatchToast({ header: 'Error', body: 'Failed to copy link', variant: 'danger', autohide: false })
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
  const dispatchToast = useToast()
  const url = `https://stacker.news/items/${item.id}${me ? `/r/${me.name}` : ''}`
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
          dispatchToast({ body: 'Link copied!', variant: 'success', autohide: true, delay: 5000 })
        } catch (err) {
          console.error(err)
          dispatchToast({ header: 'Error', body: 'Failed to copy link', variant: 'danger', autohide: false })
        }
      }}
    >
      copy link
    </Dropdown.Item>
  )
}
