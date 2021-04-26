import itemStyles from './item.module.css'
import styles from './comment.module.css'
import Text from './text'
import Link from 'next/link'
import Reply from './reply'
import { useState } from 'react'
import { gql, useQuery } from '@apollo/client'
import { timeSince } from '../lib/time'
import UpVote from './upvote'

function Parent ({ item }) {
  const { data } = useQuery(
    gql`{
      root(id: ${item.id}) {
        id
        title
      }
    }`
  )

  const ParentFrag = () => (
    <>
      <span> \ </span>
      <Link href={`/items/${item.parentId}`} passHref>
        <a className='text-reset'>parent</a>
      </Link>
    </>
  )

  if (!data) {
    return <ParentFrag />
  }

  return (
    <>
      {data.root.id !== item.parentId && <ParentFrag />}
      <span> \ </span>
      <Link href={`/items/${data.root.id}`} passHref>
        <a className='text-reset'>{data.root.title}</a>
      </Link>
    </>
  )
}

export default function Comment ({ item, children, replyOpen, includeParent, cacheId, noReply }) {
  const [reply, setReply] = useState(replyOpen)

  return (
    <>
      <div />
      <div>
        <div className={`${itemStyles.item} ${styles.item}`}>
          <UpVote itemId={item.id} meSats={item.meSats} className={styles.upvote} />
          <div className={itemStyles.hunk}>
            <div className={itemStyles.other}>
              <Link href={`/${item.user.name}`} passHref>
                <a>@{item.user.name}</a>
              </Link>
              <span> </span>
              <span>{timeSince(new Date(item.createdAt))}</span>
              <span> \ </span>
              <span>{item.sats} sats</span>
              <span> \ </span>
              <Link href={`/items/${item.id}`} passHref>
                <a className='text-reset'>{item.ncomments} replies</a>
              </Link>
              {includeParent && <Parent item={item} />}
            </div>
            <div className={styles.text}>
              <Text>{item.text}</Text>
            </div>
          </div>
        </div>
        <div className={`${itemStyles.children} ${styles.children}`}>
          {!noReply &&
            <div
              className={`${itemStyles.other} ${styles.reply}`}
              onClick={() => setReply(!reply)}
            >
              {reply ? 'cancel' : 'reply'}
            </div>}
          {reply && <Reply parentId={item.id} onSuccess={() => setReply(replyOpen || false)} cacheId={cacheId} />}
          {children}
          <div className={styles.comments}>
            {item.comments
              ? item.comments.map((item) => (
                <Comment key={item.id} item={item} />
                ))
              : null}
          </div>
        </div>
      </div>
    </>
  )
}

export function CommentSkeleton ({ skeletonChildren }) {
  const comments = skeletonChildren ? new Array(2).fill(null) : []

  return (
    <>
      <div className={`${itemStyles.item} ${itemStyles.skeleton} ${styles.item} ${styles.skeleton}`}>
        <UpVote className={styles.upvote} />
        <div className={`${itemStyles.hunk} ${styles.hunk}`}>
          <div className={itemStyles.other}>
            <span className={`${itemStyles.otherItem} ${itemStyles.otherItemLonger} clouds`} />
            <span className={`${itemStyles.otherItem} clouds`} />
            <span className={`${itemStyles.otherItem} ${itemStyles.otherItemLonger} clouds`} />
          </div>
          <div className={`${styles.text} clouds`} />
        </div>
      </div>
      <div className={`${itemStyles.children} ${styles.children}`}>
        <div className={styles.comments}>
          {comments
            ? comments.map((_, i) => (
              <CommentSkeleton key={i} />
              ))
            : null}
        </div>
      </div>
    </>
  )
}
