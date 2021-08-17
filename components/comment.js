import itemStyles from './item.module.css'
import styles from './comment.module.css'
import Text from './text'
import Link from 'next/link'
import Reply from './reply'
import { useEffect, useRef, useState } from 'react'
import { timeSince } from '../lib/time'
import UpVote from './upvote'
import Eye from '../svgs/eye-fill.svg'
import EyeClose from '../svgs/eye-close-line.svg'
import { useRouter } from 'next/router'
import { useMe } from './me'
import CommentEdit from './comment-edit'
import Countdown from './countdown'

function Parent ({ item, rootText }) {
  const ParentFrag = () => (
    <>
      <span> \ </span>
      <Link href={`/items/${item.parentId}`} passHref>
        <a onClick={e => e.stopPropagation()} className='text-reset'>parent</a>
      </Link>
    </>
  )

  if (!item.root) {
    return <ParentFrag />
  }

  return (
    <>
      {Number(item.root.id) !== Number(item.parentId) && <ParentFrag />}
      <span> \ </span>
      <Link href={`/items/${item.root.id}`} passHref>
        <a onClick={e => e.stopPropagation()} className='text-reset'>{rootText || 'on:'} {item.root.title}</a>
      </Link>
    </>
  )
}

export default function Comment ({ item, children, replyOpen, includeParent, rootText, noComments, noReply, clickToContext }) {
  const [reply, setReply] = useState(replyOpen)
  const [edit, setEdit] = useState()
  const [collapse, setCollapse] = useState(false)
  const ref = useRef(null)
  const router = useRouter()
  const me = useMe()
  const mine = me?.id === item.user.id
  const editThreshold = new Date(item.createdAt).getTime() + 10 * 60000
  const [canEdit, setCanEdit] =
    useState(mine && (Date.now() < editThreshold))

  console.log('wtf router', router, item.id, ref.current)

  useEffect(() => {
    if (Number(router.query.commentId) === Number(item.id)) {
      console.log(ref.current.scrollTop)
      ref.current.scrollIntoView()
      // ref.current.classList.add('flash-it')
    }
  }, [item])

  return (
    <div
      ref={ref} onClick={() => {
        if (clickToContext) {
          console.log('pushing')
          // router.push(`/items/${item.parentId}?commentId=${item.id}`, `/items/${item.parentId}`, { scroll: false })
          router.push({
            pathname: '/items/[id]',
            query: { id: item.parentId, commentId: item.id }
          }, `/items/${item.parentId}`)
        }
      }} className={includeParent ? `${clickToContext ? styles.clickToContext : ''}` : `${styles.comment} ${collapse ? styles.collapsed : ''}`}
    >
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
                <a onClick={e => e.stopPropagation()} className='text-reset'>{item.ncomments} replies</a>
              </Link>
              <span> \ </span>
              <Link href={`/${item.user.name}`} passHref>
                <a onClick={e => e.stopPropagation()}>@{item.user.name}</a>
              </Link>
              <span> </span>
              <span>{timeSince(new Date(item.createdAt))}</span>
              {includeParent && <Parent item={item} rootText={rootText} />}
            </div>
            {!includeParent && (collapse
              ? <Eye className={styles.collapser} height={10} width={10} onClick={() => setCollapse(false)} />
              : <EyeClose className={styles.collapser} height={10} width={10} onClick={() => setCollapse(true)} />)}

          </div>
          {edit
            ? (
              <div className={styles.replyWrapper}>
                <CommentEdit
                  comment={item}
                  onSuccess={() => {
                    setEdit(!edit)
                    setCanEdit(mine && (Date.now() < editThreshold))
                  }}
                  onCancel={() => {
                    setEdit(!edit)
                    setCanEdit(mine && (Date.now() < editThreshold))
                  }}
                  editThreshold={editThreshold}
                />
              </div>
              )
            : (
              <div className={styles.text}>
                <Text>{item.text}</Text>
              </div>
              )}
        </div>
      </div>
      <div className={`${itemStyles.children} ${styles.children}`}>
        {!noReply && !edit && (
          <div className={`${itemStyles.other} ${styles.reply}`}>
            <div
              className='d-inline-block'
              onClick={() => setReply(!reply)}
            >
              {reply ? 'cancel' : 'reply'}
            </div>
            {canEdit && !reply && !edit &&
              <>
                <span> \ </span>
                <div
                  className='d-inline-block'
                  onClick={() => setEdit(!edit)}
                >
                  edit
                  <Countdown
                    date={editThreshold}
                    className=' '
                    onComplete={() => {
                      setCanEdit(false)
                    }}
                  />
                </div>
              </>}
          </div>
        )}

        <div className={reply ? styles.replyWrapper : 'd-none'}>
          <Reply
            parentId={item.id} autoFocus={!replyOpen}
            onSuccess={() => setReply(replyOpen || false)}
          />
        </div>
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
          {skeletonChildren
            ? <CommentSkeleton skeletonChildren={skeletonChildren - 1} />
            : null}
        </div>
      </div>
    </div>
  )
}
