import Link from 'next/link'
import styles from './item.module.css'
import { timeSince } from '../lib/time'
import UpVote from './upvote'
import { useMe } from './me'
import { useState } from 'react'
import Countdown from './countdown'
import { NOFOLLOW_LIMIT } from '../lib/constants'

export default function Item ({ item, rank, children }) {
  const me = useMe()
  const mine = me?.id === item.user.id
  const editThreshold = new Date(item.createdAt).getTime() + 10 * 60000
  const [canEdit, setCanEdit] =
    useState(mine && (Date.now() < editThreshold))
  return (
    <>
      {rank
        ? (
          <div className={styles.rank}>
            {rank}
          </div>)
        : <div />}
      <div className={styles.item}>
        <UpVote itemId={item.id} meSats={item.meSats} className={styles.upvote} />
        <div className={styles.hunk}>
          <div className={`${styles.main} flex-wrap`}>
            <Link href={`/items/${item.id}`} passHref>
              <a className={`${styles.title} text-reset mr-2`}>{item.title}</a>
            </Link>
            {item.url &&
              <a
                className={styles.link} target='_blank' href={item.url} // eslint-disable-line
                rel={item.sats + item.boost >= NOFOLLOW_LIMIT ? null : 'nofollow'}
              >
                {item.url.replace(/(^https?:|^)\/\//, '')}
              </a>}
          </div>
          <div className={`${styles.other}`}>
            <span>{item.sats} sats</span>
            <span> \ </span>
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
              <span>{timeSince(new Date(item.createdAt))}</span>
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

export function ItemSkeleton ({ rank, children }) {
  return (
    <>
      {rank &&
        <div className={styles.rank}>
          {rank}
        </div>}
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
