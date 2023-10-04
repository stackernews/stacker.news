import Item from './item'
import ItemJob from './item-job'
import Reply from './reply'
import Comment from './comment'
import Text, { SearchText } from './text'
import ZoomableImage from './image'
import Comments from './comments'
import styles from '../styles/item.module.css'
import itemStyles from './item.module.css'
import { NOFOLLOW_LIMIT } from '../lib/constants'
import { useMe } from './me'
import Button from 'react-bootstrap/Button'
import { TwitterTweetEmbed } from 'react-twitter-embed'
import YouTube from 'react-youtube'
import useDarkMode from './dark-mode'
import { useEffect, useRef, useState } from 'react'
import Poll from './poll'
import { commentsViewed } from '../lib/new-comments'
import Related from './related'
import PastBounties from './past-bounties'
import Check from '../svgs/check-double-line.svg'
import Share from './share'
import Toc from './table-of-contents'
import Link from 'next/link'
import { RootProvider } from './root'
import { IMGPROXY_URL_REGEXP } from '../lib/url'
import { numWithUnits } from '../lib/format'

function BioItem ({ item, handleClick }) {
  const me = useMe()
  if (!item.text) {
    return null
  }

  return (
    <>
      <ItemText item={item} />
      {me?.name === item.user.name &&
        <div className='d-flex'>
          <Button
            className='ms-auto'
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
  const [darkMode] = useDarkMode()
  const [overflowing, setOverflowing] = useState(false)
  const [show, setShow] = useState(false)

  const twitter = item.url?.match(/^https?:\/\/(?:twitter|x)\.com\/(?:#!\/)?\w+\/status(?:es)?\/(?<id>\d+)/)
  if (twitter?.groups?.id) {
    return (
      <div className={`${styles.twitterContainer} ${show ? '' : styles.twitterContained}`}>
        <TwitterTweetEmbed tweetId={twitter.groups.id} options={{ width: '550px', theme: darkMode ? 'dark' : 'light' }} placeholder={<TweetSkeleton />} onLoad={() => setOverflowing(true)} />
        {overflowing && !show &&
          <Button size='lg' variant='info' className={styles.twitterShowFull} onClick={() => setShow(true)}>
            show full tweet
          </Button>}
      </div>
    )
  }

  const youtube = item.url?.match(/(https?:\/\/)?((www\.)?(youtube(-nocookie)?|youtube.googleapis)\.com.*(v\/|v=|vi=|vi\/|e\/|embed\/|user\/.*\/u\/\d+\/)|youtu\.be\/)(?<id>[_0-9a-z-]+)((?:\?|&)(?:t|start)=(?<start>\d+))?/i)
  if (youtube?.groups?.id) {
    return (
      <div style={{ maxWidth: '640px', paddingRight: '15px' }}>
        <YouTube
          videoId={youtube.groups.id} className={styles.youtubeContainer} opts={{
            playerVars: {
              start: youtube?.groups?.start
            }
          }}
        />
      </div>
    )
  }

  if (item.url?.match(IMGPROXY_URL_REGEXP)) {
    return <ZoomableImage src={item.url} />
  }

  return null
}

function FwdUsers ({ forwards }) {
  return (
    <div className={styles.other}>
      zaps forwarded to {' '}
      {forwards.map((fwd, index, arr) => (
        <span key={fwd.user.name}>
          <Link href={`/${fwd.user.name}`}>
            @{fwd.user.name}
          </Link>
          {` (${fwd.pct}%)`}{index !== arr.length - 1 && ' '}
        </span>))}

    </div>
  )
}

function TopLevelItem ({ item, noReply, ...props }) {
  const ItemComponent = item.isJob ? ItemJob : Item
  const replyRef = useRef()
  const contentContainerRef = useRef()

  return (
    <ItemComponent
      item={item}
      replyRef={replyRef}
      full
      right={
        !noReply &&
          <>
            <Share item={item} />
            <Toc text={item.text} />
          </>
      }
      belowTitle={item.forwards && item.forwards.length > 0 && <FwdUsers forwards={item.forwards} />}
      {...props}
    >
      <div className={styles.fullItemContainer} ref={contentContainerRef}>
        {item.text && <ItemText item={item} />}
        {item.url && <ItemEmbed item={item} />}
        {item.poll && <Poll item={item} />}
        {item.bounty &&
          <div className='fw-bold mt-2'>
            {item.bountyPaidTo?.length
              ? (
                <div className='px-3 py-1 d-inline-block bg-grey-medium rounded text-success'>
                  <Check className='fill-success' /> {numWithUnits(item.bounty, { abbreviate: false, format: true })} paid
                  {item.bountyPaidTo.length > 1 && <small className='fw-light'> {new Set(item.bountyPaidTo).size} times</small>}
                </div>)
              : (
                <div className='px-3 py-1 d-inline-block bg-grey-darkmode rounded text-light'>
                  {numWithUnits(item.bounty, { abbreviate: false, format: true })} bounty
                </div>)}
          </div>}
      </div>
      {!noReply &&
        <>
          <Reply item={item} replyOpen placeholder={item.ncomments ? undefined : 'start the conversation ...'} ref={replyRef} contentContainerRef={contentContainerRef} />
          {!item.position && !item.isJob && !item.parentId && !item.bounty > 0 && <Related title={item.title} itemId={item.id} />}
          {item.bounty > 0 && <PastBounties item={item} />}
        </>}
    </ItemComponent>
  )
}

function ItemText ({ item }) {
  return item.searchText
    ? <SearchText text={item.searchText} />
    : <Text topLevel nofollow={item.sats + item.boost < NOFOLLOW_LIMIT} imgproxyUrls={item.imgproxyUrls}>{item.text}</Text>
}

export default function ItemFull ({ item, bio, rank, ...props }) {
  useEffect(() => {
    commentsViewed(item)
  }, [item.lastCommentAt])

  return (
    <>
      {rank
        ? (
          <div className={`${itemStyles.rank} pt-2 align-self-start`}>
            {rank}
          </div>)
        : <div />}
      <RootProvider root={item.root || item}>
        {item.parentId
          ? <Comment topLevel item={item} replyOpen includeParent noComments {...props} />
          : (
            <div>{bio
              ? <BioItem item={item} {...props} />
              : <TopLevelItem item={item} {...props} />}
            </div>)}
        {item.comments &&
          <div className={styles.comments}>
            <Comments
              parentId={item.id} parentCreatedAt={item.createdAt}
              pinned={item.position} bio={bio} commentSats={item.commentSats} comments={item.comments}
            />
          </div>}
      </RootProvider>
    </>
  )
}
