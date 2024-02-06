import Link from 'next/link'
import styles from './item.module.css'
import UpVote from './upvote'
import { useRef } from 'react'
import { AD_USER_ID, NOFOLLOW_LIMIT } from '../lib/constants'
import Pin from '../svgs/pushpin-fill.svg'
import reactStringReplace from 'react-string-replace'
import PollIcon from '../svgs/bar-chart-horizontal-fill.svg'
import BountyIcon from '../svgs/bounty-bag.svg'
import ActionTooltip from './action-tooltip'
import ImageIcon from '../svgs/image-fill.svg'
import { numWithUnits } from '../lib/format'
import ItemInfo from './item-info'
import Prism from '../svgs/prism.svg'
import { commentsViewedAt } from '../lib/new-comments'
import { useRouter } from 'next/router'
import { Badge } from 'react-bootstrap'
import AdIcon from '../svgs/advertisement-fill.svg'
import { DownZap } from './dont-link-this'

export function SearchTitle ({ title }) {
  return reactStringReplace(title, /\*\*\*([^*]+)\*\*\*/g, (match, i) => {
    return <mark key={`strong-${match}-${i}`}>{match}</mark>
  })
}

export default function Item ({ item, rank, belowTitle, right, full, children, siblingComments, onQuoteReply, pinnable }) {
  const titleRef = useRef()
  const router = useRouter()

  const image = item.url && item.url.startsWith(process.env.NEXT_PUBLIC_IMGPROXY_URL)
  const nofollow = item.sats + item.boost < NOFOLLOW_LIMIT && !item.position ? 'nofollow' : ''

  return (
    <>
      {rank
        ? (
          <div className={styles.rank}>
            {rank}
          </div>)
        : <div />}
      <div className={`${styles.item} ${siblingComments ? 'pt-3' : ''}`}>
        {item.position && (pinnable || !item.subName)
          ? <Pin width={24} height={24} className={styles.pin} />
          : item.meDontLikeSats > item.meSats
            ? <DownZap width={24} height={24} className={styles.dontLike} id={item.id} meDontLikeSats={item.meDontLikeSats} />
            : Number(item.user?.id) === AD_USER_ID
              ? <AdIcon width={24} height={24} className={styles.ad} />
              : <UpVote item={item} className={styles.upvote} />}
        <div className={styles.hunk}>
          <div className={`${styles.main} flex-wrap`}>
            <Link
              rel={nofollow}
              href={`/items/${item.id}`}
              onClick={(e) => {
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
              }} ref={titleRef} className={`${styles.title} text-reset me-2`}
            >
              {item.searchTitle ? <SearchTitle title={item.searchTitle} /> : item.title}
              {item.pollCost && <span className={styles.icon}> <PollIcon className='fill-grey ms-1' height={14} width={14} /></span>}
              {item.bounty > 0 &&
                <span className={styles.icon}>
                  <ActionTooltip notForm overlayText={`${numWithUnits(item.bounty)} ${item.bountyPaidTo?.length ? ' paid' : ' bounty'}`}>
                    <BountyIcon className={`${styles.bountyIcon} ${item.bountyPaidTo?.length ? 'fill-success' : 'fill-grey'}`} height={16} width={16} />
                  </ActionTooltip>
                </span>}
              {item.forwards?.length > 0 && <span className={styles.icon}><Prism className='fill-grey ms-1' height={14} width={14} /></span>}
              {image && <span className={styles.icon}><ImageIcon className='fill-grey ms-2' height={16} width={16} /></span>}
            </Link>
            {item.url && !image &&
              <>
                <a
                  className={styles.link} target='_blank' href={item.url}
                  rel={`noreferrer ${nofollow} noopener`}
                >
                  {item.url.replace(/(^https?:|^)\/\//, '')}
                </a>
              </>}
          </div>
          <ItemInfo
            full={full} item={item}
            onQuoteReply={onQuoteReply}
            nofollow={nofollow}
            pinnable={pinnable}
            extraBadges={Number(item?.user?.id) === AD_USER_ID && <Badge className={styles.newComment} bg={null}>AD</Badge>}
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

export function ItemSkeleton ({ rank, children }) {
  return (
    <>
      {rank
        ? (
          <div className={styles.rank}>
            {rank}
          </div>)
        : <div />}
      <div className={`${styles.item} ${styles.skeleton}`}>
        <UpVote className={styles.upvote} />
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
