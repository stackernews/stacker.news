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

function hoistNestedPins (comments, rootId) {
  const hoisted = []
  function walk (nodes) {
    return (nodes || []).map(node => {
      const children = node.comments?.comments || []
      const keptChildren = []
      let removedPinnedChildren = 0
      let adoptedChildren = 0
      for (const child of children) {
        if (child.position && child.parentId !== rootId) {
          removedPinnedChildren += 1
          const adopted = child.comments?.comments || []
          adoptedChildren += adopted.length
          hoisted.push({
            ...child,
            nDirectComments: 0,
            comments: {
              ...(child.comments || {}),
              comments: []
            }
          })
          keptChildren.push(...adopted)
          continue
        }
        keptChildren.push(child)
      }
      const walkedChildren = walk(keptChildren)
      if (!node.comments) return node
      const adjustedNDirectComments = typeof node.nDirectComments === 'number'
        ? Math.max(0, node.nDirectComments - removedPinnedChildren + adoptedChildren)
        : node.nDirectComments
      return {
        ...node,
        nDirectComments: adjustedNDirectComments,
        comments: {
          ...node.comments,
          comments: walkedChildren
        }
      }
    })
  }
  return {
    comments: walk(comments || []),
    hoisted
  }
}

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
  commentSats, commentCost, commentBoost, comments, commentsCursor, fetchMoreComments, ncomments, lastCommentAt, item, ...props
}) {
  const router = useRouter()

  // fetch new comments that arrived after the lastCommentAt, and update the item.comments field in cache
  useLiveComments(parentId, lastCommentAt || parentCreatedAt)

  // new comments navigator, tracks new comments and provides navigation controls
  const { navigator } = useCommentsNavigatorContext()

  const { comments: displayComments, hoisted } = useMemo(() => hoistNestedPins(comments, Number(parentId)), [comments, parentId])
  const pins = useMemo(
    () => [...(displayComments?.filter(({ position }) => !!position) || []), ...hoisted].sort((a, b) => a.position - b.position), [displayComments, hoisted])
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
