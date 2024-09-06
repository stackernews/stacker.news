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
import { useEffect } from 'react'
import Poll from './poll'
import { commentsViewed } from '@/lib/new-comments'
import Related from './related'
import PastBounties from './past-bounties'
import Check from '@/svgs/check-double-line.svg'
import Share from './share'
import Toc from './table-of-contents'
import Link from 'next/link'
import { RootProvider } from './root'
import { decodeProxyUrl, IMGPROXY_URL_REGEXP } from '@/lib/url'
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

function ItemEmbed ({ url, imgproxyUrls }) {
  const src = IMGPROXY_URL_REGEXP.test(url) ? decodeProxyUrl(url) : url
  const srcSet = imgproxyUrls?.[url]

  return <MediaOrLink src={src} srcSet={srcSet} topLevel linkFallback={false} />
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
        {item.url && !item.outlawed && <ItemEmbed url={item.url} imgproxyUrls={item.imgproxyUrls} />}
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
