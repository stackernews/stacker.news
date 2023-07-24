import Dropdown from 'react-bootstrap/Dropdown'
import ShareIcon from '../svgs/share-fill.svg'
import copy from 'clipboard-copy'
import { useMe } from './me'

export default function Share ({ item }) {
  const me = useMe()
  const url = `https://stacker.news/items/${item.id}${me ? `/r/${me.name}` : ''}`

  return typeof window !== 'undefined' && navigator?.share
    ? (
      <div className='ms-auto pointer d-flex align-items-center'>
        <ShareIcon
          width={20} height={20}
          className='mx-2 fill-grey theme'
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: item.title || '',
                text: '',
                url
              }).then(() => console.log('Successful share'))
                .catch((error) => console.log('Error sharing', error))
            } else {
              console.log('no navigator.share')
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
              copy(url)
            }}
          >
            copy link
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>)
}

export function CopyLinkDropdownItem ({ item }) {
  const me = useMe()
  const url = `https://stacker.news/items/${item.id}${me ? `/r/${me.name}` : ''}`
  return (
    <Dropdown.Item
      onClick={async () => {
        if (navigator.share) {
          navigator.share({
            title: item.title || '',
            text: '',
            url
          }).then(() => console.log('Successful share'))
            .catch((error) => console.log('Error sharing', error))
        } else {
          copy(url)
        }
      }}
    >
      copy link
    </Dropdown.Item>
  )
}
