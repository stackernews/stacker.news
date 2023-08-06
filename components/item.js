import Link from 'next/link'
import styles from './item.module.css'
import UpVote from './upvote'
import { useRef, useState } from 'react'
import { NOFOLLOW_LIMIT } from '../lib/constants'
import Pin from '../svgs/pushpin-fill.svg'
import reactStringReplace from 'react-string-replace'
import PollIcon from '../svgs/bar-chart-horizontal-fill.svg'
import BountyIcon from '../svgs/bounty-bag.svg'
import ActionTooltip from './action-tooltip'
import Flag from '../svgs/flag-fill.svg'
import ImageIcon from '../svgs/image-fill.svg'
import { abbrNum } from '../lib/format'
import ItemInfo from './item-info'
import { commentsViewedAt } from '../lib/new-comments'
import { useRouter } from 'next/router'

export function SearchTitle ({ title }) {
  return reactStringReplace(title, /:high\[([^\]]+)\]/g, (match, i) => {
    return <mark key={`mark-${match}`}>{match}</mark>
  })
}

export default function Item ({ item, rank, belowTitle, right, full, children, siblingComments }) {
  const titleRef = useRef()
  const router = useRouter()
  const [pendingSats, setPendingSats] = useState(0)

  const image = item.url && item.url.startsWith(process.env.NEXT_PUBLIC_IMGPROXY_URL)

  return (
    <>
      {rank
        ? (
          <div className={styles.rank}>
            {rank}
          </div>)
        : <div />}
      <div className={`${styles.item} ${siblingComments ? 'pt-2' : ''}`}>
        {item.position
          ? <Pin width={24} height={24} className={styles.pin} />
          : item.meDontLike ? <Flag width={24} height={24} className={styles.dontLike} /> : <UpVote item={item} className={styles.upvote} pendingSats={pendingSats} setPendingSats={setPendingSats} />}
        <div className={styles.hunk}>
          <div className={`${styles.main} flex-wrap`}>
            <Link
              href={`/items/${item.id}`}
              onClick={(e) => {
                const viewedAt = commentsViewedAt(item)
                if (viewedAt) {
                  e.preventDefault()
                  router.push(
                    `/items/${item.id}?commentsViewedAt=${viewedAt}`,
                    `/items/${item.id}`)
                }
              }} ref={titleRef} className={`${styles.title} text-reset me-2`}
            >
              {item.searchTitle ? <SearchTitle title={item.searchTitle} /> : item.title}
              {item.pollCost && <span className={styles.icon}> <PollIcon className='fill-grey ms-1' height={14} width={14} /></span>}
              {item.bounty > 0 &&
                <span className={styles.icon}>
                  <ActionTooltip notForm overlayText={`${abbrNum(item.bounty)} ${item.bountyPaidTo?.length ? 'sats paid' : 'sats bounty'}`}>
                    <BountyIcon className={`${styles.bountyIcon} ${item.bountyPaidTo?.length ? 'fill-success' : 'fill-grey'}`} height={16} width={16} />
                  </ActionTooltip>
                </span>}
              {image && <span className={styles.icon}><ImageIcon className='fill-grey ms-2' height={16} width={16} /></span>}
            </Link>
            {item.url && !image &&
              <>
                {/*  eslint-disable-next-line */}
                <a
                  className={styles.link} target='_blank' href={item.url}
                  rel={item.sats + item.boost >= NOFOLLOW_LIMIT ? null : 'nofollow'}
                >
                  {item.url.replace(/(^https?:|^)\/\//, '')}
                </a>
              </>}
          </div>
          <ItemInfo full={full} item={item} pendingSats={pendingSats} />
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
