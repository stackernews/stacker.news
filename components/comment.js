import itemStyles from './item.module.css'
import styles from './comment.module.css'
import Text, { SearchText, LexicalText } from './text'
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
import { getParsedHTML } from '@/lib/dompurify'

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

// sanitizes HTML via getParsedHTML
// truncates the resulting HTML and returns it
const truncateHTML = (html = '', text = '', maxLines = 3) => {
  try {
    const doc = getParsedHTML(html)
    const body = doc.body

    // take the first maxLines child nodes
    const nodes = Array.from(body.children).slice(0, maxLines)

    // create a new container with the first maxLines child nodes
    const container = doc.createElement('div')
    nodes.forEach(node => {
      container.appendChild(node.cloneNode(true))
    })

    return container.innerHTML
  } catch (error) {
    console.error('error truncating HTML: ', error)
    return text ? truncateString(text) : ''
  }
}

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
  rootText, noComments, noReply, truncate, depth, pin, setDisableRetry, disableRetry,
  navigator
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

  const unsetOutline = () => {
    if (!ref.current) return

    const classes = ref.current.classList
    const hasOutline = classes.contains('outline-new-comment')
    const hasLiveOutline = classes.contains('outline-new-live-comment')
    const hasOutlineUnset = classes.contains('outline-new-comment-unset')

    // don't try to untrack and unset the outline if the comment is not outlined or we already unset the outline
    if (!(hasLiveOutline || hasOutline) || hasOutlineUnset) return

    classes.add('outline-new-comment-unset')
    // untrack new comment and its descendants if it's not a live comment
    navigator?.untrackNewComment(ref, { includeDescendants: hasOutline })
  }

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
    // checking navigator because outlining should happen only on item pages
    if (!navigator || me?.id === item.user?.id) return

    const itemCreatedAt = new Date(item.createdAt).getTime()

    const meViewedAt = new Date(root.meCommentsViewedAt).getTime()
    const viewedAt = me?.id ? meViewedAt : router.query.commentsViewedAt

    const isNewComment = viewedAt && itemCreatedAt > viewedAt
    // live comments are new regardless of me or anon view time
    const rootLast = new Date(root.lastCommentAt || root.createdAt).getTime()
    const isNewLiveComment = item.live && itemCreatedAt > (meViewedAt || rootLast)

    if (!isNewComment && !isNewLiveComment) return

    if (item.live) {
      // live comments (item.live) have to use a different class to outline every new comment
      ref.current.classList.add('outline-new-live-comment')

      // wait for the injection animation to end before removing its class
      ref.current.addEventListener('animationend', () => {
        ref.current.classList.remove(styles.liveComment)
      }, { once: true })
      // animate the live comment injection
      ref.current.classList.add(styles.liveComment)
    } else {
      ref.current.classList.add('outline-new-comment')
    }

    navigator.trackNewComment(ref, itemCreatedAt)
  }, [item.id, root.lastCommentAt, root.meCommentsViewedAt])

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
      onMouseEnter={unsetOutline}
      onTouchStart={unsetOutline}
    >
      <div className={`${itemStyles.item} ${styles.item}`}>
        {item.outlawed && !me?.privates?.wildWestMode
          ? <Skull className={styles.dontLike} width={24} height={24} />
          : pin
            ? <Pin width={22} height={22} className={styles.pin} />
            : item.mine
              ? <Boost item={item} className={styles.upvote} />
              : item.meDontLikeSats > item.meSats
                ? <DownZap width={24} height={24} className={styles.dontLike} item={item} />
                : <UpVote item={item} className={styles.upvote} collapsed={collapse === 'yep'} />}
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
                  full={topLevel}
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
                  : item.lexicalState
                    ? (
                      <LexicalText lexicalState={item.lexicalState} html={item.html} imgproxyUrls={item.imgproxyUrls} outlawed={item.outlawed} rel={item.rel ?? UNKNOWN_LINK_REL}>
                        {item.outlawed && !me?.privates?.wildWestMode
                          ? <i className='text-muted'>stackers have outlawed this. turn on wild west mode in your <Link href='/settings'>settings</Link> to see outlawed content.</i>
                          : truncate ? <div dangerouslySetInnerHTML={{ __html: truncateHTML(item.html) }} /> : undefined}
                      </LexicalText>
                      )
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
          ? <div className={styles.children}><div className={classNames(styles.comment, 'mt-3 pb-2')}><ViewMoreReplies item={item} threadContext /></div></div>
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
                        <Comment depth={depth + 1} key={item.id} item={item} navigator={navigator} />
                      ))}
                      {item.comments.comments.length < item.nDirectComments && (
                        <div className={`d-block ${styles.comment} pb-2 ps-3`}>
                          <ViewMoreReplies item={item} />
                        </div>
                      )}
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

export function ViewMoreReplies ({ item, threadContext = false }) {
  const root = useRoot()
  const id = threadContext ? commentSubTreeRootId(item, root) : item.id

  // if threadContext is true, we travel to some comments before the current comment, focusing on the comment itself
  // otherwise, we directly navigate to the comment
  const href = `/items/${id}` + (threadContext ? `?commentId=${item.id}` : '')

  const text = threadContext && item.ncomments === 0
    ? 'reply on another page'
    : `view all ${item.ncomments} replies`

  return (
    <Link
      href={href}
      as={`/items/${id}`}
      className='fw-bold d-flex align-items-center gap-2 text-muted'
    >
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
