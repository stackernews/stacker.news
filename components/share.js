import { Dropdown } from 'react-bootstrap'
import ShareIcon from '../svgs/share-fill.svg'
import copy from 'clipboard-copy'
import { useMe } from './me'

export default function Share ({ item }) {
  const me = useMe()
  const url = `https://stacker.news/items/${item.id}${me ? `/r/${me.name}` : ''}`

  return typeof window !== 'undefined' && navigator?.share
    ? (
      <div className='ml-auto d-flex align-items-center'>
        <ShareIcon
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
      <Dropdown alignRight className='ml-auto pointer  d-flex align-items-center' as='span'>
        <Dropdown.Toggle variant='success' id='dropdown-basic' as='a'>
          <ShareIcon className='mx-2 fill-grey theme' />
        </Dropdown.Toggle>

        <Dropdown.Menu>
          <Dropdown.Item
            className='text-center'
            onClick={async () => {
              copy(url)
            }}
          >
            copy link
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>)
}
