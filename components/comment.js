import itemStyles from './item.module.css'
import styles from './comment.module.css'
import Text from './text'
import Link from 'next/link'
import Reply from './reply'
import { useState } from 'react'
import { gql, useQuery } from '@apollo/client'
import { timeSince } from '../lib/time'
import UpVote from './upvote'
import Eye from '../svgs/eye-fill.svg'
import EyeClose from '../svgs/eye-close-line.svg'

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

export default function Comment ({ item, children, replyOpen, includeParent, cacheId, noComments, noReply }) {
  const [reply, setReply] = useState(replyOpen)
  const [collapse, setCollapse] = useState(false)

  return (
    <div className={includeParent ? '' : `${styles.comment} ${collapse ? styles.collapsed : ''}`}>
      <div className={`${itemStyles.item} ${styles.item}`}>
        <UpVote itemId={item.id} meSats={item.meSats} className={styles.upvote} />
        <div className={`${itemStyles.hunk} ${styles.hunk}`}>
          <div className='d-flex align-items-center'>
            <div className={`${itemStyles.other} ${styles.other}`}>
              <span>{item.sats} sats</span>
              <span> \ </span>
              <span>{item.boost} boost</span>
              <span> \ </span>
              <Link href={`/items/${item.id}`} passHref>
                <a className='text-reset'>{item.ncomments} replies</a>
              </Link>
              <span> \ </span>
              <Link href={`/${item.user.name}`} passHref>
                <a>@{item.user.name}</a>
              </Link>
              <span> </span>
              <span>{timeSince(new Date(item.createdAt))}</span>
              {includeParent && <Parent item={item} />}
            </div>
            {!includeParent && (collapse
              ? <Eye className={styles.collapser} height={10} width={10} onClick={() => setCollapse(false)} />
              : <EyeClose className={styles.collapser} height={10} width={10} onClick={() => setCollapse(true)} />)}

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
        {reply &&
          <div className={styles.replyWrapper}>
            <Reply parentId={item.id} onSuccess={() => setReply(replyOpen || false)} cacheId={cacheId} />
          </div>}
        {children}
        <div className={`${styles.comments} ml-sm-1 ml-md-3`}>
          {item.comments && !noComments
            ? item.comments.map((item) => (
              <Comment key={item.id} item={item} />
              ))
            : null}
        </div>
      </div>
    </div>
  )
}

export function CommentSkeleton ({ skeletonChildren }) {
  const comments = skeletonChildren > 0 ? new Array(skeletonChildren).fill(null) : []

  return (
    <div className={styles.comment}>
      <div className={`${itemStyles.item} ${itemStyles.skeleton} ${styles.item} ${styles.skeleton}`}>
        <UpVote className={styles.upvote} />
        <div className={`${itemStyles.hunk} ${styles.hunk}`}>
          <div className={itemStyles.other}>
            <span className={`${itemStyles.otherItem} clouds`} />
            <span className={`${itemStyles.otherItem} clouds`} />
            <span className={`${itemStyles.otherItem} clouds`} />
            <span className={`${itemStyles.otherItem} ${itemStyles.otherItemLonger} clouds`} />
          </div>
          <div className={`${styles.text} clouds`} />
        </div>
      </div>
      <div className={`${itemStyles.children} ${styles.children} ${styles.skeleton}`}>
        <div className={styles.replyPadder}>
          <div className={`${itemStyles.other} ${styles.reply} clouds`} />
        </div>
        <div className={`${styles.comments} ml-sm-1 ml-md-3`}>
          {comments
            ? comments.map((_, i) => (
              <CommentSkeleton key={i} skeletonChildren={skeletonChildren - 1} />
              ))
            : null}
        </div>
      </div>
    </div>
  )
}
