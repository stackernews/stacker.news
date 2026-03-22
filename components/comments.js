import { Fragment, useMemo } from 'react'
import Comment, { CommentSkeleton } from './comment'
import styles from './header.module.css'
import Nav from 'react-bootstrap/Nav'
import Navbar from 'react-bootstrap/Navbar'
import { numWithUnits } from '@/lib/format'
import { defaultCommentSort } from '@/lib/item'
import { useRouter } from 'next/router'
import MoreFooter from './more-footer'
import { FULL_COMMENTS_THRESHOLD } from '@/lib/constants'
import useLiveComments from './use-live-comments'
import { useCommentsNavigatorContext } from './use-comments-navigator'
import { hoistNestedPins } from './comments-pin'

export function CommentsHeader ({ handleSort, pinned, bio, parentCreatedAt, commentSats, commentCost, commentBoost }) {
  const router = useRouter()
  const sort = router.query.sort || defaultCommentSort(pinned, bio, parentCreatedAt)

  const getHandleClick = sort => {
    return () => {
      handleSort(sort)
    }
  }

  return (
    <Navbar className='pt-1 pb-0 px-3'>
      <Nav
        className={styles.navbarNav}
        activeKey={sort}
      >
        <Nav.Item className='text-muted' title={`${numWithUnits(commentSats + commentCost + commentBoost)} (${commentSats} stacked \\ ${commentCost} cost \\ ${commentBoost} boost)`}>
          {numWithUnits(commentSats + commentCost + commentBoost)}
        </Nav.Item>
        <div className='ms-auto d-flex'>
          <Nav.Item>
            <Nav.Link
              eventKey='lit'
              className={`${styles.navLink} ${styles.navSort}`}
              onClick={getHandleClick('lit')}
            >
              lit
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey='new'
              className={`${styles.navLink} ${styles.navSort}`}
              onClick={getHandleClick('new')}
            >
              new
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey='top'
              className={`${styles.navLink} ${styles.navSort}`}
              onClick={getHandleClick('top')}
            >
              top
            </Nav.Link>
          </Nav.Item>
        </div>
      </Nav>
    </Navbar>
  )
}

export default function Comments ({
  parentId, pinned, bio, parentCreatedAt,
  commentSats, commentCost, commentBoost, comments, commentsPins, commentsCursor, fetchMoreComments, ncomments, lastCommentAt, item, ...props
}) {
  const router = useRouter()

  // fetch new comments that arrived after the lastCommentAt, and update the item.comments field in cache
  useLiveComments(parentId, lastCommentAt || parentCreatedAt)

  // new comments navigator, tracks new comments and provides navigation controls
  const { navigator } = useCommentsNavigatorContext()

  const rootId = Number(item?.root?.id || parentId)
  const isRootThread = Number(parentId) === rootId
  const { comments: displayComments, hoisted } = useMemo(() => {
    if (!isRootThread) return { comments: comments || [], hoisted: [] }
    return hoistNestedPins(comments, rootId)
  }, [comments, isRootThread, rootId])
  const pins = useMemo(
    () => {
      if (!isRootThread) return []
      const fromApi = commentsPins || []
      const fallback = [...displayComments.filter(({ position }) => Boolean(position)), ...hoisted]
      const source = fromApi.length ? fromApi : fallback
      return source
        .reduce((acc, pin) => {
          if (acc.some(({ id }) => Number(id) === Number(pin.id))) return acc
          acc.push(pin)
          return acc
        }, [])
        .sort((a, b) => (a.position - b.position) || (a.id - b.id))
    },
    [commentsPins, displayComments, hoisted, isRootThread]
  )
  return (
    <>
      {comments?.length > 0
        ? <CommentsHeader
            commentSats={commentSats} commentCost={commentCost} commentBoost={commentBoost} parentCreatedAt={parentCreatedAt}
            pinned={pinned} bio={bio} handleSort={sort => {
              const { commentsViewedAt, commentId, ...query } = router.query
              delete query.nodata
              router.push({
                pathname: router.pathname,
                query: { ...query, commentsViewedAt, sort }
              }, {
                pathname: `/items/${parentId}`,
                query: sort === defaultCommentSort(pinned, bio, parentCreatedAt) ? undefined : { sort }
              }, { scroll: false })
            }}
          />
        : null}
      {pins.map(item => (
        <Fragment key={item.id}>
          <Comment depth={1} item={item} navigator={navigator} {...props} pin />
        </Fragment>
      ))}
      {displayComments.filter(({ position }) => !position).map(item => (
        <Comment depth={1} key={item.id} item={item} navigator={navigator} {...props} />
      ))}
      {ncomments > FULL_COMMENTS_THRESHOLD &&
        <MoreFooter
          cursor={commentsCursor} fetchMore={fetchMoreComments} noMoreText=' '
          count={comments?.length}
          Skeleton={CommentsSkeleton}
        />}
    </>
  )
}

export function CommentsSkeleton () {
  return <CommentSkeleton skeletonChildren={7} />
}
