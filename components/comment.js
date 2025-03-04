import itemStyles from './item.module.css'
import styles from './comment.module.css'
import Text, { SearchText } from './text'
import Link from 'next/link'
import Reply from './reply'
import { useEffect, useMemo, useRef, useState } from 'react'
import UpVote from './upvote'
import Eye from '@/svgs/eye-fill.svg'
import EyeClose from '@/svgs/eye-close-line.svg'
import { useRouter } from 'next/router'
import CommentEdit from './comment-edit'
import { USER_ID, COMMENT_DEPTH_LIMIT, UNKNOWN_LINK_REL } from '@/lib/constants'
import PayBounty from './pay-bounty'
import BountyIcon from '@/svgs/bounty-bag.svg'
import ActionTooltip from './action-tooltip'
import { numWithUnits } from '@/lib/format'
import Share from './share'
import ItemInfo from './item-info'
import Badge from 'react-bootstrap/Badge'
import { RootProvider, useRoot } from './root'
import { useMe } from './me'
import { useQuoteReply } from './use-quote-reply'
import { DownZap } from './dont-link-this'
import Skull from '@/svgs/death-skull.svg'
import { commentSubTreeRootId } from '@/lib/item'
import Pin from '@/svgs/pushpin-fill.svg'
import LinkToContext from './link-to-context'
import Boost from './boost-button'
import { gql, useApolloClient } from '@apollo/client'
import classNames from 'classnames'

function Parent ({ item, rootText }) {
  const root = useRoot()

  const ParentFrag = () => (
    <>
      <span> \ </span>
      <Link href={`/items/${item.parentId}`} className='text-reset'>
        parent
      </Link>
    </>
  )

  return (
    <>
      {Number(root.id) !== Number(item.parentId) && <ParentFrag />}
      <span> \ </span>
      <Link href={`/items/${root.id}`} className='text-reset'>
        {rootText || 'on:'} {root?.title}
      </Link>
      {root.subName &&
        <Link href={`/~${root.subName}`}>
          {' '}<Badge className={itemStyles.newComment} bg={null}>{root.subName}</Badge>
        </Link>}
    </>
  )
}

const truncateString = (string = '', maxLength = 140) =>
  string.length > maxLength
    ? `${string.substring(0, maxLength)} […]`
    : string

export function CommentFlat ({ item, rank, siblingComments, ...props }) {
  const router = useRouter()
  const [href, as] = useMemo(() => {
    const rootId = commentSubTreeRootId(item)
    return [{
      pathname: '/items/[id]',
      query: { id: rootId, commentId: item.id }
    }, `/items/${rootId}`]
  }, [item?.id])

  return (
    <>
      {rank
        ? (
          <div className={`${itemStyles.rank} pt-2 align-self-start`}>
            {rank}
          </div>)
        : <div />}
      <LinkToContext
        className='py-2'
        onClick={e => {
          e.preventDefault()
          router.push(href, as)
        }}
        href={href}
      >
        <RootProvider root={item.root}>
          <Comment item={item} {...props} />
        </RootProvider>
      </LinkToContext>
    </>
  )
}

export default function Comment ({
  item, children, replyOpen, includeParent, topLevel,
  rootText, noComments, noReply, truncate, depth, pin, setDisableRetry, disableRetry
}) {
  const [edit, setEdit] = useState()
  const { me } = useMe()
  const isHiddenFreebie = me?.privates?.satsFilter !== 0 && !item.mine && item.freebie && !item.freedFreebie
  const isDeletedChildless = item?.ncomments === 0 && item?.deletedAt
  const [collapse, setCollapse] = useState(
    (isHiddenFreebie || isDeletedChildless || item?.user?.meMute || (item?.outlawed && !me?.privates?.wildWestMode)) && !includeParent
      ? 'yep'
      : 'nope')
  const ref = useRef(null)
  const router = useRouter()
  const root = useRoot()
  const { ref: textRef, quote, quoteReply, cancelQuote } = useQuoteReply({ text: item.text })

  const { cache } = useApolloClient()

  useEffect(() => {
    const comment = cache.readFragment({
      id: `Item:${router.query.commentId}`,
      fragment: gql`
        fragment CommentPath on Item {
          path
        }`
    })
    if (comment?.path.split('.').includes(item.id)) {
      window.localStorage.setItem(`commentCollapse:${item.id}`, 'nope')
    }
    setCollapse(window.localStorage.getItem(`commentCollapse:${item.id}`) || collapse)
    if (Number(router.query.commentId) === Number(item.id)) {
      // HACK wait for other comments to uncollapse if they're collapsed
      setTimeout(() => {
        ref.current.scrollIntoView({ behavior: 'instant', block: 'start' })
        // make sure we can outline a comment again if it was already outlined before
        ref.current.addEventListener('animationend', () => {
          ref.current.classList.remove('outline-it')
        }, { once: true })
        ref.current.classList.add('outline-it')
      }, 100)
    }
  }, [item.id, cache, router.query.commentId])

  useEffect(() => {
    if (router.query.commentsViewedAt &&
        me?.id !== item.user?.id &&
        new Date(item.createdAt).getTime() > router.query.commentsViewedAt) {
      ref.current.classList.add('outline-new-comment')
    }
  }, [item.id])

  const bottomedOut = depth === COMMENT_DEPTH_LIMIT || (item.comments?.comments.length === 0 && item.nDirectComments > 0)
  // Don't show OP badge when anon user comments on anon user posts
  const op = root.user.name === item.user.name && Number(item.user.id) !== USER_ID.anon
    ? 'OP'
    : root.forwards?.some(f => f.user.name === item.user.name) && Number(item.user.id) !== USER_ID.anon
      ? 'fwd'
      : null
  const bountyPaid = root.bountyPaidTo?.includes(Number(item.id))

  return (
    <div
      ref={ref} className={includeParent ? '' : `${styles.comment} ${collapse === 'yep' ? styles.collapsed : ''}`}
      onMouseEnter={() => ref.current.classList.add('outline-new-comment-unset')}
      onTouchStart={() => ref.current.classList.add('outline-new-comment-unset')}
    >
      <div className={`${itemStyles.item} ${styles.item}`}>
        {item.outlawed && !me?.privates?.wildWestMode
          ? <Skull className={styles.dontLike} width={24} height={24} />
          : item.mine
            ? <Boost item={item} className={styles.upvote} />
            : item.meDontLikeSats > item.meSats
              ? <DownZap width={24} height={24} className={styles.dontLike} item={item} />
              : pin ? <Pin width={22} height={22} className={styles.pin} /> : <UpVote item={item} className={styles.upvote} collapsed={collapse === 'yep'} />}
        <div className={`${itemStyles.hunk} ${styles.hunk}`}>
          <div className='d-flex align-items-center'>
            {item.user?.meMute && !includeParent && collapse === 'yep'
              ? (
                <span
                  className={`${itemStyles.other} ${styles.other} pointer`} onClick={() => {
                    setCollapse('nope')
                    window.localStorage.setItem(`commentCollapse:${item.id}`, 'nope')
                  }}
                >reply from someone you muted
                </span>)
              : <ItemInfo
                  item={item}
                  commentsText='replies'
                  commentTextSingular='reply'
                  className={`${itemStyles.other} ${styles.other}`}
                  embellishUser={op && <><span> </span><Badge bg={op === 'fwd' ? 'secondary' : 'boost'} className={`${styles.op} bg-opacity-75`}>{op}</Badge></>}
                  onQuoteReply={quoteReply}
                  nested={!includeParent}
                  setDisableRetry={setDisableRetry}
                  disableRetry={disableRetry}
                  extraInfo={
                    <>
                      {includeParent && <Parent item={item} rootText={rootText} />}
                      {bountyPaid &&
                        <ActionTooltip notForm overlayText={`${numWithUnits(root.bounty)} paid`}>
                          <BountyIcon className={`${styles.bountyIcon} ${'fill-success vertical-align-middle'}`} height={16} width={16} />
                        </ActionTooltip>}
                    </>
                  }
                  edit={edit}
                  toggleEdit={e => { setEdit(!edit) }}
                  editText={edit ? 'cancel' : 'edit'}
                />}

            {!includeParent && (collapse === 'yep'
              ? <Eye
                  className={styles.collapser} height={10} width={10} onClick={() => {
                    setCollapse('nope')
                    window.localStorage.setItem(`commentCollapse:${item.id}`, 'nope')
                  }}
                />
              : <EyeClose
                  className={styles.collapser} height={10} width={10} onClick={() => {
                    setCollapse('yep')
                    window.localStorage.setItem(`commentCollapse:${item.id}`, 'yep')
                  }}
                />)}
            {topLevel && (
              <span className='d-flex ms-auto align-items-center'>
                <Share title={item?.title} path={`/items/${item?.id}`} />
              </span>
            )}
          </div>
          {edit
            ? (
              <CommentEdit
                comment={item}
                onSuccess={() => {
                  setEdit(!edit)
                }}
              />
              )
            : (
              <div className={styles.text} ref={textRef}>
                {item.searchText
                  ? <SearchText text={item.searchText} />
                  : (
                    <Text itemId={item.id} topLevel={topLevel} rel={item.rel ?? UNKNOWN_LINK_REL} outlawed={item.outlawed} imgproxyUrls={item.imgproxyUrls}>
                      {item.outlawed && !me?.privates?.wildWestMode
                        ? '*stackers have outlawed this. turn on wild west mode in your [settings](/settings) to see outlawed content.*'
                        : truncate ? truncateString(item.text) : item.text}
                    </Text>)}
              </div>
              )}
        </div>
      </div>
      {collapse !== 'yep' && (
        bottomedOut
          ? <div className={styles.children}><div className={classNames(styles.comment, 'mt-3')}><ReplyOnAnotherPage item={item} /></div></div>
          : (
            <div className={styles.children}>
              {item.outlawed && !me?.privates?.wildWestMode
                ? <div className='py-2' />
                : !noReply &&
                  <Reply depth={depth + 1} item={item} replyOpen={replyOpen} onCancelQuote={cancelQuote} onQuoteReply={quoteReply} quote={quote}>
                    {root.bounty && !bountyPaid && <PayBounty item={item} />}
                  </Reply>}
              {children}
              <div className={styles.comments}>
                {!noComments && item.comments?.comments
                  ? (
                    <>
                      {item.comments.comments.map((item) => (
                        <Comment depth={depth + 1} key={item.id} item={item} />
                      ))}
                      {item.comments.comments.length < item.nDirectComments && <ViewAllReplies id={item.id} nhas={item.ncomments} />}
                    </>
                    )
                  : null}
                {/* TODO: add link to more comments if they're limited */}
              </div>
            </div>
            )
      )}
    </div>
  )
}

export function ViewAllReplies ({ id, nshown, nhas }) {
  const text = `view all ${nhas} replies`

  return (
    <div className={`d-block fw-bold ${styles.comment} pb-2 ps-3`}>
      <Link href={`/items/${id}`} as={`/items/${id}`} className='text-muted'>
        {text}
      </Link>
    </div>
  )
}

function ReplyOnAnotherPage ({ item }) {
  const root = useRoot()
  const rootId = commentSubTreeRootId(item, root)

  let text = 'reply on another page'
  if (item.ncomments > 0) {
    text = `view all ${item.ncomments} replies`
  }

  return (
    <Link href={`/items/${rootId}?commentId=${item.id}`} as={`/items/${rootId}`} className='d-block pb-2 fw-bold text-muted'>
      {text}
    </Link>
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
        <div className={`${styles.comments} ms-sm-1 ms-md-3`}>
          {skeletonChildren
            ? <CommentSkeleton skeletonChildren={skeletonChildren - 1} />
            : null}
        </div>
      </div>
    </div>
  )
}
