import Link from 'next/link'
import styles from './item.module.css'
import { timeSince } from '../lib/time'
import UpVote from './upvote'
import { useEffect, useRef, useState } from 'react'
import Countdown from './countdown'
import { NOFOLLOW_LIMIT } from '../lib/constants'
import Pin from '../svgs/pushpin-fill.svg'
import reactStringReplace from 'react-string-replace'
import { formatSats } from '../lib/format'
import * as Yup from 'yup'
import Briefcase from '../svgs/briefcase-4-fill.svg'
import Toc from './table-of-contents'

function SearchTitle ({ title }) {
  return reactStringReplace(title, /:high\[([^\]]+)\]/g, (match, i) => {
    return <mark key={`mark-${match}`}>{match}</mark>
  })
}

export function ItemJob ({ item, toc, rank, children }) {
  const isEmail = Yup.string().email().isValidSync(item.url)

  return (
    <>
      {rank
        ? (
          <div className={styles.rank}>
            {rank}
          </div>)
        : <div />}
      <div className={`${styles.item} ${item.status === 'NOSATS' && !item.mine ? styles.itemDead : ''}`}>
        <Briefcase width={24} height={24} className={styles.case} />
        <div className={styles.hunk}>
          <div className={`${styles.main} flex-wrap d-inline`}>
            <Link href={`/items/${item.id}`} passHref>
              <a className={`${styles.title} text-reset mr-2`}>
                {item.searchTitle
                  ? <SearchTitle title={item.searchTitle} />
                  : (
                    <>{item.title}
                      {item.company &&
                        <>
                          <span> \ </span>
                          {item.company}
                        </>}
                      {(item.location || item.remote) &&
                        <>
                          <span> \ </span>
                          {`${item.location || ''}${item.location && item.remote ? ' or ' : ''}${item.remote ? 'Remote' : ''}`}
                        </>}
                    </>)}
              </a>
            </Link>
            {/*  eslint-disable-next-line */}
              <a
                className={`${styles.link}`}
                target='_blank' href={(isEmail ? 'mailto:' : '') + item.url}
              >
                apply
              </a>
          </div>
          <div className={`${styles.other}`}>
            {item.status !== 'NOSATS'
              ? <span>{formatSats(item.maxBid)} sats per min</span>
              : <span>expired</span>}
            <span> \ </span>
            <Link href={`/items/${item.id}`} passHref>
              <a className='text-reset'>{item.ncomments} comments</a>
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
            </span>
            {item.mine &&
              <>
                <span> \ </span>
                <Link href={`/items/${item.id}/edit`} passHref>
                  <a className='text-reset'>
                    edit
                  </a>
                </Link>
                {item.status !== 'ACTIVE' && <span className='font-weight-bold text-danger'> {item.status}</span>}
              </>}
          </div>
        </div>
        {toc && <Toc text={item.text} />}
      </div>
      {children && (
        <div className={`${styles.children}`}>
          {children}
        </div>
      )}
    </>
  )
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

  useEffect(() => {
    setWrap(
      Math.ceil(parseFloat(window.getComputedStyle(titleRef.current).lineHeight)) <
        titleRef.current.clientHeight)
  }, [])

  return (
    <>
      {rank
        ? (
          <div className={styles.rank}>
            {rank}
          </div>)
        : <div />}
      <div className={styles.item}>
        {item.position ? <Pin width={24} height={24} className={styles.pin} /> : <UpVote item={item} className={styles.upvote} />}
        <div className={styles.hunk}>
          <div className={`${styles.main} flex-wrap ${wrap ? 'd-inline' : ''}`}>
            <Link href={`/items/${item.id}`} passHref>
              <a ref={titleRef} className={`${styles.title} text-reset mr-2`}>
                {item.searchTitle ? <SearchTitle title={item.searchTitle} /> : item.title}
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
                <span title={`from ${item.upvotes} users (${item.meSats} sats from me)`}>{item.sats} sats</span>
                <span> \ </span>
              </>}
            {item.boost > 0 &&
              <>
                <span>{item.boost} boost</span>
                <span> \ </span>
              </>}
            <Link href={`/items/${item.id}`} passHref>
              <a className='text-reset'>{item.ncomments} comments</a>
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
        {toc && <Toc text={item.text} />}
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
