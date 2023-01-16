import Item from './item'
import ItemJob from './item-job'
import Reply from './reply'
import Comment from './comment'
import Text from './text'
import Comments from './comments'
import styles from '../styles/item.module.css'
import { NOFOLLOW_LIMIT } from '../lib/constants'
import { useMe } from './me'
import { Button } from 'react-bootstrap'
import { TwitterTweetEmbed } from 'react-twitter-embed'
import YouTube from 'react-youtube'
import useDarkMode from 'use-dark-mode'
import { useEffect, useState } from 'react'
import Poll from './poll'
import { commentsViewed } from '../lib/new-comments'
import Related from './related'
import PastBounties from './past-bounties'

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
      <Reply item={item} />
    </>
  )
}

function TweetSkeleton () {
  return (
    <div className={styles.tweetsSkeleton}>
      <div className={styles.tweetSkeleton}>
        <div className={`${styles.img} clouds`} />
        <div className={styles.content1}>
          <div className={`${styles.line} clouds`} />
          <div className={`${styles.line} clouds`} />
          <div className={`${styles.line} clouds`} />
        </div>
      </div>
    </div>
  )
}

function ItemEmbed ({ item }) {
  const darkMode = useDarkMode()
  const [overflowing, setOverflowing] = useState(false)
  const [show, setShow] = useState(false)

  const twitter = item.url?.match(/^https?:\/\/twitter\.com\/(?:#!\/)?\w+\/status(?:es)?\/(?<id>\d+)/)
  if (twitter?.groups?.id) {
    return (
      <div className={`${styles.twitterContainer} ${show ? '' : styles.twitterContained}`}>
        <TwitterTweetEmbed tweetId={twitter.groups.id} options={{ width: '550px', theme: darkMode.value ? 'dark' : 'light' }} placeholder={<TweetSkeleton />} onLoad={() => setOverflowing(true)} />
        {overflowing && !show &&
          <Button size='lg' variant='info' className={styles.twitterShowFull} onClick={() => setShow(true)}>
            show full tweet
          </Button>}
      </div>
    )
  }

  const youtube = item.url?.match(/(https?:\/\/)?((www\.)?(youtube(-nocookie)?|youtube.googleapis)\.com.*(v\/|v=|vi=|vi\/|e\/|embed\/|user\/.*\/u\/\d+\/)|youtu\.be\/)(?<id>[_0-9a-z-]+)((?:\?|&)(?:t|start)=(?<start>\d+))?/i)
  if (youtube?.groups?.id) {
    console.log(youtube?.groups?.start)
    return (
      <div style={{ maxWidth: '640px', paddingRight: '15px' }}>
        <YouTube
          videoId={youtube.groups.id} containerClassName={styles.youtubeContainer} opts={{
            playerVars: {
              start: youtube?.groups?.start
            }
          }}
        />
      </div>
    )
  }

  return null
}

function TopLevelItem ({ item, noReply, ...props }) {
  const ItemComponent = item.isJob ? ItemJob : Item

  return (
    <ItemComponent item={item} toc showFwdUser {...props}>
      {item.text && <ItemText item={item} />}
      {item.url && <ItemEmbed item={item} />}
      {item.poll && <Poll item={item} />}
      {!noReply &&
        <>
          <Reply item={item} replyOpen />
          {!item.position && !item.isJob && !item.parentId && !item.bounty > 0 && <Related title={item.title} itemId={item.id} />}
          {item.bounty > 0 && <PastBounties item={item} />}
        </>}
    </ItemComponent>
  )
}

function ItemText ({ item }) {
  return <Text topLevel nofollow={item.sats + item.boost < NOFOLLOW_LIMIT}>{item.searchText || item.text}</Text>
}

export default function ItemFull ({ item, bio, ...props }) {
  useEffect(() => {
    commentsViewed(item)
  }, [item.lastCommentAt])

  return (
    <>
      {item.parentId
        ? <Comment topLevel item={item} replyOpen includeParent noComments {...props} />
        : (
          <div className='mt-1'>{
          bio
            ? <BioItem item={item} {...props} />
            : <TopLevelItem item={item} {...props} />
          }
          </div>)}
      {item.comments &&
        <div className={styles.comments}>
          <Comments parentId={item.id} commentSats={item.commentSats} comments={item.comments} />
        </div>}
    </>
  )
}
