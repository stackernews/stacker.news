import Link from 'next/link'
import styles from './item.module.css'
import UpVote from './upvote'
import { useRef } from 'react'
import { USER_ID, UNKNOWN_LINK_REL } from '@/lib/constants'
import Pin from '@/svgs/pushpin-fill.svg'
import reactStringReplace from 'react-string-replace'
import PollIcon from '@/svgs/bar-chart-horizontal-fill.svg'
import BountyIcon from '@/svgs/bounty-bag.svg'
import ActionTooltip from './action-tooltip'
import ImageIcon from '@/svgs/image-fill.svg'
import VideoIcon from '@/svgs/video-on-fill.svg'
import { numWithUnits } from '@/lib/format'
import ItemInfo from './item-info'
import Prism from '@/svgs/prism.svg'
import { commentsViewedAt } from '@/lib/new-comments'
import { useRouter } from 'next/router'
import { Badge } from 'react-bootstrap'
import AdIcon from '@/svgs/advertisement-fill.svg'
import { DownZap } from './dont-link-this'
import { timeLeft } from '@/lib/time'
import classNames from 'classnames'
import removeMd from 'remove-markdown'
import { decodeProxyUrl, IMGPROXY_URL_REGEXP, parseInternalLinks } from '@/lib/url'
import ItemPopover from './item-popover'
import { useMe } from './me'
import Boost from './boost-button'

function onItemClick (e, router, item) {
  const viewedAt = commentsViewedAt(item)
  if (viewedAt) {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      window.open(
        `/items/${item.id}`,
        '_blank',
        'noopener,noreferrer'
      )
    } else {
      router.push(
        `/items/${item.id}?commentsViewedAt=${viewedAt}`,
        `/items/${item.id}`)
    }
  }
}

export function SearchTitle ({ title }) {
  return reactStringReplace(title, /\*\*\*([^*]+)\*\*\*/g, (match, i) => {
    return <mark key={`strong-${match}-${i}`}>{match}</mark>
  })
}

function mediaType ({ url, imgproxyUrls }) {
  const { me } = useMe()
  const src = IMGPROXY_URL_REGEXP.test(url) ? decodeProxyUrl(url) : url
  if (!imgproxyUrls?.[src] ||
    me?.privates?.showImagesAndVideos === false ||
    // we don't proxy videos even if we have thumbnails
    (me?.privates?.imgproxyOnly && imgproxyUrls?.[src]?.video)) return
  return imgproxyUrls?.[src]?.video ? 'video' : 'image'
}

function ItemLink ({ url, rel }) {
  try {
    const { linkText } = parseInternalLinks(url)
    if (linkText) {
      return (
        <ItemPopover id={linkText.replace('#', '').split('/')[0]}>
          <Link href={url} className={styles.link}>{linkText}</Link>
        </ItemPopover>
      )
    }

    return (
      // eslint-disable-next-line
      <a
        className={styles.link} target='_blank' href={url}
        rel={rel ?? UNKNOWN_LINK_REL}
      >
        {url.replace(/(^https?:|^)\/\//, '')}
      </a>
    )
  } catch {
    return null
  }
}

export default function Item ({
  item, rank, belowTitle, right, full, children, itemClassName,
  onQuoteReply, pinnable
}) {
  const titleRef = useRef()
  const router = useRouter()

  const media = mediaType({ url: item.url, imgproxyUrls: item.imgproxyUrls })
  const MediaIcon = media === 'video' ? VideoIcon : ImageIcon

  return (
    <>
      {rank
        ? (
          <div className={styles.rank}>
            {rank}
          </div>)
        : <div />}
      <div className={classNames(styles.item, itemClassName)}>
        {item.position && (pinnable || !item.subName)
          ? <Pin width={24} height={24} className={styles.pin} />
          : item.mine
            ? <Boost item={item} className={styles.upvote} />
            : item.meDontLikeSats > item.meSats
              ? <DownZap width={24} height={24} className={styles.dontLike} item={item} />
              : Number(item.user?.id) === USER_ID.ad
                ? <AdIcon width={24} height={24} className={styles.ad} />
                : <UpVote item={item} className={styles.upvote} />}
        <div className={styles.hunk}>
          <div className={`${styles.main} flex-wrap`}>
            <Link
              href={`/items/${item.id}`}
              onClick={(e) => onItemClick(e, router, item)}
              ref={titleRef}
              className={`${styles.title} text-reset me-2`}
            >
              {item.searchTitle ? <SearchTitle title={item.searchTitle} /> : item.title}
              {item.pollCost && <PollIndicator item={item} />}
              {item.bounty > 0 &&
                <span className={styles.icon}>
                  <ActionTooltip notForm overlayText={`${numWithUnits(item.bounty)} ${item.bountyPaidTo?.length ? ' paid' : ' bounty'}`}>
                    <BountyIcon className={`${styles.bountyIcon} ${item.bountyPaidTo?.length ? 'fill-success' : 'fill-grey'}`} height={16} width={16} />
                  </ActionTooltip>
                </span>}
              {item.forwards?.length > 0 && <span className={styles.icon}><Prism className='fill-grey ms-1' height={14} width={14} /></span>}
              {media && <span className={styles.icon}><MediaIcon className='fill-grey ms-2' height={16} width={16} /></span>}
            </Link>
            {item.url && !media && <ItemLink url={item.url} rel={UNKNOWN_LINK_REL} />}
          </div>
          <ItemInfo
            full={full} item={item}
            onQuoteReply={onQuoteReply}
            pinnable={pinnable}
            extraBadges={Number(item?.user?.id) === USER_ID.ad && <Badge className={styles.newComment} bg={null}>AD</Badge>}
          />
          {belowTitle}
        </div>
        {right}
      </div>
      {children && (
        <div className={styles.children}>
          {children}
        </div>
      )}
    </>
  )
}

export function ItemSummary ({ item }) {
  const router = useRouter()
  const link = (
    <Link
      href={`/items/${item.id}`}
      onClick={(e) => onItemClick(e, router, item)}
      className={`${item.title && styles.title} ${styles.summaryText} text-reset me-2`}
    >
      {item.title ?? removeMd(item.text)}
    </Link>
  )
  const info = (
    <ItemInfo
      item={item}
      showUser={false}
      showActionDropdown={false}
      extraBadges={item.title && Number(item?.user?.id) === USER_ID.ad && <Badge className={styles.newComment} bg={null}>AD</Badge>}
    />
  )

  return (
    <div className={classNames(styles.item, 'mb-0 pb-0')}>
      <div className={styles.hunk}>
        {item.title
          ? (
            <>
              {link}
              {info}
            </>
            )
          : (
            <>
              {info}
              {link}
            </>
            )}
      </div>
    </div>
  )
}

export function ItemSkeleton ({ rank, children, showUpvote = true }) {
  return (
    <>
      {rank
        ? (
          <div className={styles.rank}>
            {rank}
          </div>)
        : <div />}
      <div className={`${styles.item} ${styles.skeleton}`}>
        {showUpvote && <UpVote className={styles.upvote} />}
        <div className={styles.hunk}>
          <div className={`${styles.main} flex-wrap flex-md-nowrap`}>
            <span className={`${styles.title} clouds text-reset flex-md-fill flex-md-shrink-0 me-2`} />
            <span className={`${styles.link} clouds`} />
          </div>
          <div className={styles.other}>
            <span className={`${styles.otherItem} clouds`} />
            <span className={`${styles.otherItem} clouds`} />
            <span className={`${styles.otherItem} ${styles.otherItemLonger} clouds`} />
            <span className={`${styles.otherItem} ${styles.otherItemLonger} clouds`} />
          </div>
        </div>
      </div>
      {children && (
        <div className={styles.children}>
          {children}
        </div>
      )}
    </>
  )
}

function PollIndicator ({ item }) {
  const hasExpiration = !!item.pollExpiresAt
  const timeRemaining = timeLeft(new Date(item.pollExpiresAt))
  const isActive = !hasExpiration || !!timeRemaining

  return (
    <span className={styles.icon} title={isActive ? 'active' : 'results in'}>
      <PollIcon
        className={`${isActive
          ? 'fill-success'
          : 'fill-grey'
          } ms-1`} height={14} width={14}
      />
    </span>
  )
}
