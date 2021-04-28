import Link from 'next/link'
import styles from './item.module.css'
import { timeSince } from '../lib/time'
import UpVote from './upvote'

export default function Item ({ item, rank, children }) {
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
          <div className={`${styles.main} flex-wrap flex-md-nowrap`}>
            <Link href={`/items/${item.id}`} passHref>
              <a className={`${styles.title} text-reset flex-md-shrink-0 mr-2`}>{item.title}</a>
            </Link>
            {item.url && <a className={styles.link} href={item.url}>{item.url.replace(/(^\w+:|^)\/\//, '')}</a>}
          </div>
          <div className={`${styles.other}`}>
            <span>{item.sats} sats</span>
            <span> \ </span>
            <span>{item.boost} boost</span>
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
              <span>{timeSince(new Date(item.createdAt))}</span>
            </span>
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
