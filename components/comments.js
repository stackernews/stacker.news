import { Fragment, useMemo } from 'react'
import Comment, { CommentSkeleton, ShowNewComments } from './comment'
import styles from './header.module.css'
import Nav from 'react-bootstrap/Nav'
import Navbar from 'react-bootstrap/Navbar'
import { numWithUnits } from '@/lib/format'
import { defaultCommentSort } from '@/lib/item'
import { useRouter } from 'next/router'
import MoreFooter from './more-footer'
import { FULL_COMMENTS_THRESHOLD } from '@/lib/constants'
import useLiveComments from './comments-live'
import ActionTooltip from './action-tooltip'
import classNames from 'classnames'

export function CommentsHeader ({ handleSort, pinned, bio, parentCreatedAt, commentSats, livePolling, setLivePolling }) {
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
        <Nav.Item className='text-muted'>
          {numWithUnits(commentSats)}
        </Nav.Item>
        {livePolling
          ? (
            <Nav.Item className='ps-2'>
              <ActionTooltip notForm overlayText='comments are live'>
                <div className={styles.newCommentDot} />
              </ActionTooltip>
            </Nav.Item>
            )
          : (
            <Nav.Item className='ps-2'>
              <ActionTooltip notForm overlayText='click to resume live comments'>
                <div
                  className={classNames(styles.newCommentDot, styles.paused)}
                  onClick={() => setLivePolling(true)}
                  style={{ cursor: 'pointer' }}
                />
              </ActionTooltip>
            </Nav.Item>
            )}
        <div className='ms-auto d-flex'>
          <Nav.Item>
            <Nav.Link
              eventKey='hot'
              className={styles.navLink}
              onClick={getHandleClick('hot')}
            >
              hot
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey='recent'
              className={styles.navLink}
              onClick={getHandleClick('recent')}
            >
              recent
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey='top'
              className={styles.navLink}
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
  commentSats, comments, commentsCursor, fetchMoreComments, ncomments, newComments, lastCommentAt, ...props
}) {
  const router = useRouter()
  // update item.newComments in cache
  const { polling: livePolling, setPolling: setLivePolling } = useLiveComments(parentId, lastCommentAt || parentCreatedAt)

  const pins = useMemo(() => comments?.filter(({ position }) => !!position).sort((a, b) => a.position - b.position), [comments])

  return (
    <>
      {comments?.length > 0
        ? <CommentsHeader
            commentSats={commentSats} parentCreatedAt={parentCreatedAt}
            pinned={pinned} bio={bio} livePolling={livePolling} setLivePolling={setLivePolling} handleSort={sort => {
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
      {newComments?.length > 0 && (
        <ShowNewComments topLevel newComments={newComments} itemId={parentId} />
      )}
      {pins.map(item => (
        <Fragment key={item.id}>
          <Comment depth={1} item={item} {...props} pin />
        </Fragment>
      ))}
      {comments.filter(({ position }) => !position).map(item => (
        <Comment depth={1} key={item.id} item={item} {...props} />
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
