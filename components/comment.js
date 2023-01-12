import itemStyles from './item.module.css'
import styles from './comment.module.css'
import Text from './text'
import Link from 'next/link'
import Reply, { ReplyOnAnotherPage } from './reply'
import { useEffect, useRef, useState } from 'react'
import { timeSince } from '../lib/time'
import UpVote from './upvote'
import Eye from '../svgs/eye-fill.svg'
import EyeClose from '../svgs/eye-close-line.svg'
import { useRouter } from 'next/router'
import CommentEdit from './comment-edit'
import Countdown from './countdown'
import { COMMENT_DEPTH_LIMIT, NOFOLLOW_LIMIT } from '../lib/constants'
import { ignoreClick } from '../lib/clicks'
import PayBounty from './pay-bounty'
import BountyIcon from '../svgs/bounty-bag.svg'
import ActionTooltip from './action-tooltip'
import { useMe } from './me'
import DontLikeThis from './dont-link-this'
import Flag from '../svgs/flag-fill.svg'
import { Badge } from 'react-bootstrap'
import { abbrNum } from '../lib/format'
import Share from './share'

function Parent ({ item, rootText }) {
  const ParentFrag = () => (
    <>
      <span> \ </span>
      <Link href={`/items/${item.parentId}`} passHref>
        <a className='text-reset'>parent</a>
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
        <a className='text-reset'>{rootText || 'on:'} {item.root.title}</a>
      </Link>
    </>
  )
}

const truncateString = (string = '', maxLength = 140) =>
  string.length > maxLength
    ? `${string.substring(0, maxLength)} […]`
    : string

export function CommentFlat ({ item, ...props }) {
  const router = useRouter()
  return (
    <div
      className='clickToContext py-2'
      onClick={e => {
        if (ignoreClick(e)) {
          return
        }
        if (item.path.split('.').length > COMMENT_DEPTH_LIMIT + 1) {
          router.push({
            pathname: '/items/[id]',
            query: { id: item.parentId, commentId: item.id }
          }, `/items/${item.parentId}`)
        } else {
          router.push({
            pathname: '/items/[id]',
            query: { id: item.root.id, commentId: item.id }
          }, `/items/${item.root.id}`)
        }
      }}
    >
      <Comment item={item} {...props} />
    </div>
  )
}

export default function Comment ({
  item, children, replyOpen, includeParent, topLevel,
  rootText, noComments, noReply, truncate, depth
}) {
  const [edit, setEdit] = useState()
  const [collapse, setCollapse] = useState(false)
  const ref = useRef(null)
  const me = useMe()
  const router = useRouter()
  const mine = item.mine
  const editThreshold = new Date(item.createdAt).getTime() + 10 * 60000
  const [canEdit, setCanEdit] =
    useState(mine && (Date.now() < editThreshold))

  useEffect(() => {
    if (Number(router.query.commentId) === Number(item.id)) {
      ref.current.scrollIntoView()
      ref.current.classList.add('flash-it')
      router.replace({
        pathname: router.pathname,
        query: { id: router.query.id }
      }, undefined, { scroll: false })
    }
    setCollapse(localStorage.getItem(`commentCollapse:${item.id}`))
  }, [item])

  const bottomedOut = depth === COMMENT_DEPTH_LIMIT

  const op = item.root?.user.name === item.user.name

  return (
    <div
      ref={ref} className={includeParent ? '' : `${styles.comment} ${collapse ? styles.collapsed : ''}`}
    >
      <div className={`${itemStyles.item} ${styles.item}`}>
        {item.meDontLike ? <Flag width={24} height={24} className={`${styles.dontLike}`} /> : <UpVote item={item} className={styles.upvote} />}
        <div className={`${itemStyles.hunk} ${styles.hunk}`}>
          <div className='d-flex align-items-center'>
            <div className={`${itemStyles.other} ${styles.other}`}>
              <span title={`from ${item.upvotes} users ${item.mine ? `\\ ${item.meSats} sats to post` : `(${item.meSats} sats from me)`}`}>{abbrNum(item.sats)} sats</span>
              <span> \ </span>
              {item.boost > 0 &&
                <>
                  <span>{abbrNum(item.boost)} boost</span>
                  <span> \ </span>
                </>}
              <Link href={`/items/${item.id}`} passHref>
                <a title={`${item.commentSats} sats`} className='text-reset'>{item.ncomments} replies</a>
              </Link>
              <span> \ </span>
              <Link href={`/${item.user.name}`} passHref>
                <a>@{item.user.name}<span className='text-boost font-weight-bold'>{op && ' OP'}</span></a>
              </Link>
              <span> </span>
              <Link href={`/items/${item.id}`} passHref>
                <a title={item.createdAt} className='text-reset'>{timeSince(new Date(item.createdAt))}</a>
              </Link>
              {includeParent && <Parent item={item} rootText={rootText} />}
              {me && !item.meSats && !item.meDontLike && !item.mine && <DontLikeThis id={item.id} />}
              {(item.outlawed && <Link href='/outlawed'><a>{' '}<Badge className={itemStyles.newComment} variant={null}>OUTLAWED</Badge></a></Link>) ||
               (item.freebie && !item.mine && (me?.greeterMode) && <Link href='/freebie'><a>{' '}<Badge className={itemStyles.newComment} variant={null}>FREEBIE</Badge></a></Link>)}
              {canEdit &&
                <>
                  <span> \ </span>
                  <div
                    className={styles.edit}
                    onClick={e => {
                      setEdit(!edit)
                    }}
                  >
                    {edit ? 'cancel' : 'edit'}
                    <Countdown
                      date={editThreshold}
                      onComplete={() => {
                        setCanEdit(false)
                      }}
                    />
                  </div>
                </>}
                {item.root.bountyPaidTo && item.root.bountyPaidTo == item.id &&
                  <ActionTooltip notForm overlayText={`${item.root.bounty} sats paid`}>
                    <BountyIcon className={`${styles.bountyIcon} ${'fill-success vertical-align-middle'}`} height={16} width={16} />
                  </ActionTooltip>
                }
            </div>
            {!includeParent && (collapse
              ? <Eye
                  className={styles.collapser} height={10} width={10} onClick={() => {
                    setCollapse(false)
                    localStorage.removeItem(`commentCollapse:${item.id}`)
                  }}
                />
              : <EyeClose
                  className={styles.collapser} height={10} width={10} onClick={() => {
                    setCollapse(true)
                    localStorage.setItem(`commentCollapse:${item.id}`, 'yep')
                  }}
                />)}
            {topLevel && <Share item={item} />}
          </div>
          {edit
            ? (
              <CommentEdit
                comment={item}
                onSuccess={() => {
                  setEdit(!edit)
                  setCanEdit(mine && (Date.now() < editThreshold))
                }}
              />
              )
            : (
              <div className={styles.text}>
                <Text topLevel={topLevel} nofollow={item.sats + item.boost < NOFOLLOW_LIMIT}>
                  {truncate ? truncateString(item.text) : item.searchText || item.text}
                </Text>
              </div>
              )}
        </div>
      </div>
      {bottomedOut
        ? <DepthLimit item={item} />
        : (
          <div className={`${styles.children}`}>
            <div className={styles.replyContainer}>
            {!noReply &&
              <Reply
              depth={depth + 1} item={item} replyOpen={replyOpen}
              />}
              {item.root?.bounty && <PayBounty item={item} />}
            </div>
            {children}
            <div className={`${styles.comments} ml-sm-1 ml-md-3`}>
              {item.comments && !noComments
                ? item.comments.map((item) => (
                  <Comment depth={depth + 1} key={item.id} item={item} />
                ))
                : null}
            </div>
          </div>
          )}
    </div>
  )
}

function DepthLimit ({ item }) {
  if (item.ncomments > 0) {
    return (
      <Link href={`/items/${item.id}`} passHref>
        <a className='d-block p-3 font-weight-bold text-muted w-100 text-center'>view replies</a>
      </Link>
    )
  }

  return (
    <div className={`${styles.children}`}>
      <ReplyOnAnotherPage parentId={item.id} />
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
