import Link from 'next/link'
import styles from './item.module.css'
import { timeSince } from '../lib/time'
import UpVote from './upvote'
import { useEffect, useRef, useState } from 'react'
import Countdown from './countdown'
import { NOFOLLOW_LIMIT } from '../lib/constants'
import Pin from '../svgs/pushpin-fill.svg'
import reactStringReplace from 'react-string-replace'
import Toc from './table-of-contents'
import PollIcon from '../svgs/bar-chart-horizontal-fill.svg'
import BountyIcon from '../svgs/bounty-bag.svg'
import ActionTooltip from './action-tooltip'
import { Badge } from 'react-bootstrap'
import { newComments } from '../lib/new-comments'
import { useMe } from './me'
import DontLikeThis from './dont-link-this'
import Flag from '../svgs/flag-fill.svg'
import Share from './share'
import { abbrNum } from '../lib/format'

export function SearchTitle ({ title }) {
  return reactStringReplace(title, /:high\[([^\]]+)\]/g, (match, i) => {
    return <mark key={`mark-${match}`}>{match}</mark>
  })
}

function FwdUser ({ user }) {
  return (
    <div className={styles.other}>
      100% of tips are forwarded to{' '}
      <Link href={`/${user.name}`} passHref>
        <a>@{user.name}</a>
      </Link>
    </div>
  )
}

export default function Item ({ item, rank, showFwdUser, toc, children }) {
  const mine = item.mine
  const editThreshold = new Date(item.createdAt).getTime() + 10 * 60000
  const [canEdit, setCanEdit] =
    useState(mine && (Date.now() < editThreshold))
  const [wrap, setWrap] = useState(false)
  const titleRef = useRef()
  const me = useMe()
  const fwd2me = me && me?.id === item?.fwdUser?.id
  const [hasNewComments, setHasNewComments] = useState(false)

  useEffect(() => {
    setWrap(
      Math.ceil(parseFloat(window.getComputedStyle(titleRef.current).lineHeight)) <
        titleRef.current.clientHeight)
  }, [])

  useEffect(() => {
    // if we are showing toc, then this is a full item
    setHasNewComments(!toc && newComments(item))
  }, [item])

  return (
    <>
      {rank
        ? (
          <div className={styles.rank}>
            {rank}
          </div>)
        : <div />}
      <div className={styles.item}>
        {item.position
          ? <Pin width={24} height={24} className={styles.pin} />
          : item.meDontLike ? <Flag width={24} height={24} className={`${styles.dontLike}`} /> : <UpVote item={item} className={styles.upvote} />}
        <div className={styles.hunk}>
          <div className={`${styles.main} flex-wrap ${wrap ? 'd-inline' : ''}`}>
            <Link href={`/items/${item.id}`} passHref>
              <a ref={titleRef} className={`${styles.title} text-reset mr-2`}>
                {item.searchTitle ? <SearchTitle title={item.searchTitle} /> : item.title}
                {item.pollCost && <span> <PollIcon className='fill-grey vertical-align-baseline' height={14} width={14} /></span>}
                {item.bounty > 0 &&
                  <span>
                    <ActionTooltip notForm overlayText={`${item.bounty} ${item.bountyPaid ? 'sats paid' : 'sats bounty'}`}>
                      <BountyIcon className={`${styles.bountyIcon} ${item.bountyPaid ? 'fill-success vertical-align-middle' : 'fill-grey vertical-align-middle'}`} height={16} width={16} />
                    </ActionTooltip>
                  </span>}
              </a>
            </Link>
            {item.url &&
              <>
                {/*  eslint-disable-next-line */}
                <a
                  className={`${styles.link} ${wrap ? styles.linkSmall : ''}`} target='_blank' href={item.url}
                  rel={item.sats + item.boost >= NOFOLLOW_LIMIT ? null : 'nofollow'}
                >
                  {item.url.replace(/(^https?:|^)\/\//, '')}
                </a>
              </>}
          </div>
          <div className={`${styles.other}`}>
            {!item.position &&
              <>
                <span title={`from ${item.upvotes} users ${item.mine ? `\\ ${item.meSats} sats to post` : `(${item.meSats} sats from me)`} `}>{abbrNum(item.sats)} sats</span>
                <span> \ </span>
              </>}
            {item.boost > 0 &&
              <>
                <span>{abbrNum(item.boost)} boost</span>
                <span> \ </span>
              </>}
            <Link href={`/items/${item.id}`} passHref>
              <a title={`${item.commentSats} sats`} className='text-reset'>
                {item.ncomments} comments
                {hasNewComments && <>{' '}<Badge className={styles.newComment} variant={null}>new</Badge></>}
              </a>
            </Link>
            <span> \ </span>
            <span>
              <Link href={`/${item.user.name}`} passHref>
                <a>@{item.user.name}</a>
              </Link>
              <span> </span>
              <Link href={`/items/${item.id}`} passHref>
                <a title={item.createdAt} className='text-reset'>{timeSince(new Date(item.createdAt))}</a>
              </Link>
              {me && !item.meSats && !item.position && !item.meDontLike && !item.mine && <DontLikeThis id={item.id} />}
              {(item.outlawed && <Link href='/outlawed'><a>{' '}<Badge className={styles.newComment} variant={null}>OUTLAWED</Badge></a></Link>) ||
               (item.freebie && !item.mine && (me?.greeterMode) && <Link href='/freebie'><a>{' '}<Badge className={styles.newComment} variant={null}>FREEBIE</Badge></a></Link>)}
              {item.prior &&
                <>
                  <span> \ </span>
                  <Link href={`/items/${item.prior}`} passHref>
                    <a className='text-reset'>yesterday</a>
                  </Link>
                </>}
            </span>
            {canEdit &&
              <>
                <span> \ </span>
                <Link href={`/items/${item.id}/edit`} passHref>
                  <a className='text-reset'>
                    edit
                    <Countdown
                      date={editThreshold}
                      className=' '
                      onComplete={() => {
                        setCanEdit(false)
                      }}
                    />
                  </a>
                </Link>
              </>}
          </div>
          {showFwdUser && item.fwdUser && <FwdUser user={item.fwdUser} />}
        </div>
        {toc &&
          <>
            <Share item={item} />
            <Toc text={item.text} />
          </>}
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
            <span className={`${styles.title} clouds text-reset flex-md-fill flex-md-shrink-0 mr-2`} />
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
