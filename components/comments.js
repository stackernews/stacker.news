import { Fragment, forwardRef, useRef, useMemo } from 'react'
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

export const CommentsHeader = forwardRef(function CommentsHeader ({ handleSort, pinned, bio, parentCreatedAt, commentSats, commentCost, commentBoost }, ref) {
  const router = useRouter()
  const sort = router.query.sort || defaultCommentSort(pinned, bio, parentCreatedAt)

  const getHandleClick = sort => {
    return () => {
      handleSort(sort)
    }
  }

  return (
    <Navbar ref={ref} className='pt-1 pb-0 px-3'>
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
})

export default function Comments ({
  parentId, pinned, bio, parentCreatedAt,
  commentSats, commentCost, commentBoost, comments, commentsCursor, fetchMoreComments, ncomments, lastCommentAt, item, ...props
}) {
  const router = useRouter()

  // fetch new comments that arrived after the lastCommentAt, and update the item.comments field in cache
  useLiveComments(parentId, lastCommentAt || parentCreatedAt)

  // new comments navigator, tracks new comments and provides navigation controls
  const { navigator } = useCommentsNavigatorContext()

  const headerRef = useRef(null)
  const pins = useMemo(() => comments?.filter(({ position }) => !!position).sort((a, b) => a.position - b.position), [comments])

  return (
    <>
      {comments?.length > 0
        ? <CommentsHeader
            ref={headerRef}
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
              }, { scroll: false }).then(() => {
                // scroll to comments header after sort change so the user
                // sees the re-sorted comments from the top, and to override
                // any scroll restoration Next.js may apply for the new URL
                if (headerRef.current) {
                  headerRef.current.scrollIntoView({ behavior: 'smooth' })
                }
              })
            }}
          />
        : null}
      {pins.map(item => (
        <Fragment key={item.id}>
          <Comment depth={1} item={item} navigator={navigator} {...props} pin />
        </Fragment>
      ))}
      {comments.filter(({ position }) => !position).map(item => (
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
