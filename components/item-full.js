import Item from './item'
import Reply from './reply'
import Comment from './comment'
import Text from './text'
import Comments from './comments'
import styles from '../styles/item.module.css'
import { NOFOLLOW_LIMIT } from '../lib/constants'
import { useMe } from './me'
import { Button } from 'react-bootstrap'

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

function TopLevelItem ({ item }) {
  return (
    <Item item={item}>
      {item.text && <ItemText item={item} />}
      <Reply parentId={item.id} replyOpen />
    </Item>
  )
}

function ItemText ({ item }) {
  return <Text nofollow={item.sats + item.boost < NOFOLLOW_LIMIT}>{item.text}</Text>
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
          <Comments comments={item.comments} />
        </div>}
    </>
  )
}
