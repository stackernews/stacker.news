import Item from './item'
import ItemJob from './item-job'
import Reply from './reply'
import Comment from './comment'
import Text, { SearchText } from './text'
import MediaOrLink from './media-or-link'
import Comments from './comments'
import styles from '@/styles/item.module.css'
import itemStyles from './item.module.css'
import { useMe } from './me'
import Button from 'react-bootstrap/Button'
import { TwitterTweetEmbed } from 'react-twitter-embed'
import YouTube from 'react-youtube'
import useDarkMode from './dark-mode'
import { useEffect, useState } from 'react'
import Poll from './poll'
import { commentsViewed } from '@/lib/new-comments'
import Related from './related'
import PastBounties from './past-bounties'
import Check from '@/svgs/check-double-line.svg'
import Share from './share'
import Toc from './table-of-contents'
import Link from 'next/link'
import { RootProvider } from './root'
import { IMGPROXY_URL_REGEXP, parseEmbedUrl } from '@/lib/url'
import { numWithUnits } from '@/lib/format'
import { useQuoteReply } from './use-quote-reply'
import { UNKNOWN_LINK_REL } from '@/lib/constants'

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

  // This Twitter embed could use similar logic to the video embeds below
  const twitter = item.url?.match(/^https?:\/\/(?:twitter|x)\.com\/(?:#!\/)?\w+\/status(?:es)?\/(?<id>\d+)/)
  if (twitter?.groups?.id) {
    return (
      <div className={`${styles.twitterContainer} ${show ? '' : styles.twitterContained}`}>
        <TwitterTweetEmbed tweetId={twitter.groups.id} options={{ theme: darkMode ? 'dark' : 'light', width: '550px' }} key={darkMode ? '1' : '2'} placeholder={<TweetSkeleton />} onLoad={() => setOverflowing(true)} />
        {overflowing && !show &&
          <Button size='lg' variant='info' className={styles.twitterShowFull} onClick={() => setShow(true)}>
            show full tweet
          </Button>}
      </div>
    )
  }

  const { provider, id, meta } = parseEmbedUrl(item.url)

  if (provider === 'youtube') {
    return (
      <div className={styles.videoWrapper}>
        <YouTube
          videoId={id} className={styles.videoContainer} opts={{
            playerVars: {
              start: meta?.start || 0
            }
          }}
        />
      </div>
    )
  }

  if (provider === 'rumble') {
    return (
      <div className={styles.videoWrapper}>
        <div className={styles.videoContainer}>
          <iframe
            title='Rumble Video'
            allowFullScreen
            src={meta?.href}
            sandbox='allow-scripts'
          />
        </div>
      </div>
    )
  }

  if (provider === 'peertube') {
    return (
      <div className={styles.videoWrapper}>
        <div className={styles.videoContainer}>
          <iframe
            title='PeerTube Video'
            allowFullScreen
            src={meta?.href}
            sandbox='allow-scripts'
          />
        </div>
      </div>
    )
  }

  if (item.url?.match(IMGPROXY_URL_REGEXP)) {
    return <MediaOrLink src={item.url} rel={item.rel ?? UNKNOWN_LINK_REL} />
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
  const { ref: textRef, quote, quoteReply, cancelQuote } = useQuoteReply({ text: item.text })

  return (
    <ItemComponent
      item={item}
      full
      onQuoteReply={quoteReply}
      right={
        !noReply &&
          <>
            <Share title={item?.title} path={`/items/${item?.id}`} />
            <Toc text={item.text} />
          </>
      }
      belowTitle={item.forwards && item.forwards.length > 0 && <FwdUsers forwards={item.forwards} />}
      {...props}
    >
      <article className={styles.fullItemContainer} ref={textRef}>
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
      </article>
      {!noReply &&
        <>
          <Reply
            item={item}
            replyOpen
            placeholder={item.ncomments > 3 ? 'fractions of a penny for your thoughts?' : 'early comments get more zaps'}
            onCancelQuote={cancelQuote}
            onQuoteReply={quoteReply}
            quote={quote}
          />
          {
          // Don't show related items for Saloon items (position is set but no subName)
          (!item.position && item.subName) &&
          // Don't show related items for jobs
          !item.isJob &&
          // Don't show related items for child items
          !item.parentId &&
          // Don't show related items for deleted items
          !item.deletedAt &&
          // Don't show related items for items with bounties, show past bounties instead
          !(item.bounty > 0) &&
            <Related title={item.title} itemId={item.id} show={item.ncomments === 0} />
          }
          {item.bounty > 0 && <PastBounties item={item} />}
        </>}
    </ItemComponent>
  )
}

function ItemText ({ item }) {
  return item.searchText
    ? <SearchText text={item.searchText} />
    : <Text itemId={item.id} topLevel rel={item.rel ?? UNKNOWN_LINK_REL} outlawed={item.outlawed} imgproxyUrls={item.imgproxyUrls}>{item.text}</Text>
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
