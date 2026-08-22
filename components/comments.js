import { Fragment, useMemo } from 'react'
import Comment, { CommentSkeleton } from './comment'
import styles from './header.module.css'
import { Nav, NavLink, NavItem } from '@/components/ui/nav'
import { numWithUnits } from '@/lib/format'
import { defaultCommentSort } from '@/lib/item'
import { useRouter } from 'next/router'
import MoreFooter from './more-footer'
import { FULL_COMMENTS_THRESHOLD } from '@/lib/constants'
import useLiveComments from './use-live-comments'
import { useCommentsNavigatorContext } from './use-comments-navigator'

export function CommentsHeader ({ handleSort, pinned, bio, parentCreatedAt, commentSats, commentCost, commentBoost }) {
  const router = useRouter()
  const sort = router.query.sort || defaultCommentSort(pinned, bio, parentCreatedAt)

  const getHandleClick = sort => {
    return () => {
      handleSort(sort)
    }
  }

  return (
    <nav className='flex items-center flex-nowrap pt-1 pb-0 px-4'>
      <Nav
        className={styles.navbarNav}
        activeKey={sort}
      >
        <NavItem className='text-muted' title={`${numWithUnits(commentSats + commentCost + commentBoost)} (${commentSats} stacked \\ ${commentCost} cost \\ ${commentBoost} boost)`}>
          {numWithUnits(commentSats + commentCost + commentBoost)}
        </NavItem>
        <div className='ms-auto flex'>
          <NavItem>
            <NavLink
              eventKey='lit'
              className={`${styles.navSort} py-1 px-2`}
              onClick={getHandleClick('lit')}
            >
              lit
            </NavLink>
          </NavItem>
          <NavItem>
            <NavLink
              eventKey='new'
              className={`${styles.navSort} py-1 px-2`}
              onClick={getHandleClick('new')}
            >
              new
            </NavLink>
          </NavItem>
          <NavItem>
            <NavLink
              eventKey='top'
              className={`${styles.navSort} py-1 px-2`}
              onClick={getHandleClick('top')}
            >
              top
            </NavLink>
          </NavItem>
        </div>
      </Nav>
    </nav>
  )
}

export default function Comments ({
  parentId, pinned, bio, parentCreatedAt,
  commentSats, commentCost, commentBoost, comments, commentsCursor, fetchMoreComments, ncomments, lastCommentAt, item, ...props
}) {
  const router = useRouter()

  // fetch new comments that arrived after the lastCommentAt, and update the item.comments field in cache
  useLiveComments(parentId, lastCommentAt || parentCreatedAt)

  // new comments navigator, tracks new comments and provides navigation controls
  const { navigator } = useCommentsNavigatorContext()

  const pins = useMemo(() => comments?.filter(({ position }) => !!position).sort((a, b) => a.position - b.position), [comments])

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
