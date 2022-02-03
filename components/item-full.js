import Item from './item'
import Reply from './reply'
import Comment from './comment'
import Text from './text'
import Comments from './comments'
import styles from '../styles/item.module.css'
import { NOFOLLOW_LIMIT } from '../lib/constants'
import { useMe } from './me'
import { Button } from 'react-bootstrap'
import TweetEmbed from 'react-tweet-embed'
import useDarkMode from 'use-dark-mode'

function BioItem ({ item, handleClick }) {
  const me = useMe()
  if (!item.text) {
    return null
  }

  return (
    <>
      <ItemText item={item} />
      {me?.name === item.user.name &&
        <div className='text-right'>
          <Button
            onClick={handleClick}
            size='md' variant='link'
          >edit bio
          </Button>
        </div>}
      <Reply parentId={item.id} />
    </>
  )
}

function ItemEmbed ({ item }) {
  const darkMode = useDarkMode()
  const twitter = item.url?.match(/^https?:\/\/twitter\.com\/(?:#!\/)?\w+\/status(?:es)?\/(?<id>\d+)/)
  if (twitter?.groups?.id) {
    return <TweetEmbed id={twitter.groups.id} options={{ width: '100%', theme: darkMode.value ? 'dark' : 'light' }} />
  }

  return null
}

function TopLevelItem ({ item, noReply, ...props }) {
  return (
    <Item item={item} {...props}>
      {item.text && <ItemText item={item} />}
      {item.url && <ItemEmbed item={item} />}
      {!noReply && <Reply parentId={item.id} replyOpen />}
    </Item>
  )
}

function ItemText ({ item }) {
  return <Text nofollow={item.sats + item.boost < NOFOLLOW_LIMIT}>{item.searchText || item.text}</Text>
}

export default function ItemFull ({ item, bio, ...props }) {
  return (
    <>
      {item.parentId
        ? <Comment item={item} replyOpen includeParent noComments {...props} />
        : (
          <div className='mt-1'>{
          bio
            ? <BioItem item={item} {...props} />
            : <TopLevelItem item={item} {...props} />
          }
          </div>)}
      {item.comments &&
        <div className={styles.comments}>
          <Comments parentId={item.id} comments={item.comments} />
        </div>}
    </>
  )
}
