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
import { decodeProxyUrl, IMGPROXY_URL_REGEXP, parseEmbedUrl } from '@/lib/url'
import { numWithUnits } from '@/lib/format'
import { useQuoteReply } from './use-quote-reply'
import { UNKNOWN_LINK_REL } from '@/lib/constants'
import classNames from 'classnames'
import { CarouselProvider } from './carousel'
import Embed from './embed'
import { useRouter } from 'next/router'
import { useMutation } from '@apollo/client'
import { UPDATE_ITEM_USER_VIEW } from '@/fragments/items'

function BioItem ({ item, handleClick }) {
  const { me } = useMe()
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
  const provider = parseEmbedUrl(url)
  if (provider) {
    return (
      <div className='mt-3'>
        <Embed src={url} {...provider} topLevel />
      </div>
    )
  }

  if (imgproxyUrls) {
    const src = IMGPROXY_URL_REGEXP.test(url) ? decodeProxyUrl(url) : url
    const srcSet = imgproxyUrls?.[url]
    return (
      <div className='mt-3'>
        <MediaOrLink src={src} srcSet={srcSet} topLevel linkFallback={false} />
      </div>
    )
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
      <article className={classNames(styles.fullItemContainer, 'topLevel')} ref={textRef}>
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

export default function ItemFull ({ item, fetchMoreComments, bio, rank, ...props }) {
  console.log('item', item)
  const { me } = useMe()
  // no cache update here because we need to preserve the initial value
  const [updateCommentsViewAt] = useMutation(UPDATE_ITEM_USER_VIEW)

  useEffect(() => {
    console.log('ITEMFULL useEffect', item)
    console.log('root', item.root)
    // local comments viewed (anon fallback)
    if (!me?.id) return commentsViewed(item)

    const last = new Date(item.lastCommentAt || item.createdAt)
    const viewedAt = new Date(item.meCommentsViewedAt)

    if (viewedAt.getTime() >= last.getTime()) return

    console.log('ITEMFULL updating comments viewed at', last)
    // me server comments viewed
    updateCommentsViewAt({
      variables: { id: item.id, meCommentsViewedAt: last }
    })
  }, [item.id, item.lastCommentAt, item.createdAt, item.meCommentsViewedAt, me?.id])

  const router = useRouter()
  const carouselKey = `${item.id}-${router.query?.sort || 'default'}`

  return (
    <>
      {rank
        ? (
          <div className={`${itemStyles.rank} pt-2 align-self-start`}>
            {rank}
          </div>)
        : <div />}
      <RootProvider root={item.root || item}>
        <CarouselProvider key={carouselKey}>
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
                pinned={item.position} bio={bio} commentSats={item.commentSats}
                ncomments={item.ncomments}
                comments={item.comments.comments}
                commentsCursor={item.comments.cursor}
                fetchMoreComments={fetchMoreComments}
                lastCommentAt={item.lastCommentAt}
                item={item}
              />
            </div>}
        </CarouselProvider>
      </RootProvider>
    </>
  )
}
