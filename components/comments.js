import { Fragment, useState } from 'react'
import Comment, { CommentSkeleton } from './comment'
import styles from './header.module.css'
import Nav from 'react-bootstrap/Nav'
import Navbar from 'react-bootstrap/Navbar'
import { numWithUnits } from '../lib/format'
import { defaultCommentSort } from '../lib/item'
import { useRouter } from 'next/router'
import { NEW_COMMENTS, ITEM_WITH_COMMENTS } from '../fragments/comments'
import { useApolloClient, useQuery } from '@apollo/client'
import { SSR } from '../lib/constants'
import { ITEM_FULL } from '../fragments/items'

export function CommentsHeader ({ handleSort, pinned, bio, parentCreatedAt, commentSats }) {
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

export default function Comments ({ parentId, pinned, bio, parentCreatedAt, commentSats, comments, lastCommentAt, newComments, ...props }) {
  const router = useRouter()
  useNewCommentFetcher(parentId, lastCommentAt || parentCreatedAt)

  const pins = comments?.filter(({ position }) => !!position).sort((a, b) => a.position - b.position)

  return (
    <>
      {comments?.length > 0
        ? <CommentsHeader
            commentSats={commentSats} parentCreatedAt={parentCreatedAt}
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
          <Comment depth={1} item={item} {...props} pin />
        </Fragment>
      ))}
      {comments.filter(({ position }) => !position).map(item => (
        <Comment depth={1} key={item.id} item={item} {...props} />
      ))}
    </>
  )
}

export function CommentsSkeleton () {
  return <CommentSkeleton skeletonChildren={7} />
}

function useNewCommentFetcher (rootId, afterTimestamp) {
  const client = useApolloClient()
  const [newCommentsLastCheckedAt, setNewCommentsLastCheckedAt] = useState(afterTimestamp)
  const { data } = useQuery(NEW_COMMENTS, SSR
    ? { ssr: false }
    : {
        pollInterval: 10000,
        variables: { rootId, after: newCommentsLastCheckedAt }
      })

  if (data && data.newComments) {
    saveNewCommentsToCache(client, rootId, data.newComments)
    const latestCommentCreatedAt = findLatestCommentCreatedAt(data.newComments)
    if (latestCommentCreatedAt) {
      setNewCommentsLastCheckedAt(latestCommentCreatedAt)
    }
  }

  return null
}

function saveNewCommentsToCache (client, rootId, newComments) {
  for (const newComment of newComments) {
    const parentId = newComment.parentId.toString()
    // New top-level comments must use updateQuery while new nested comments
    // must use updateFragment to update the correct view components
    if (parentId === rootId) {
      client.cache.updateQuery({
        query: ITEM_FULL,
        variables: { id: rootId }
      }, (data) => {
        if (!data) return data
        const { item } = data

        const existingNewComments = item.newComments || []
        const isAlreadyInNewComments = existingNewComments.some(existing => existing.id === newComment.id)
        const updatedNewComments = isAlreadyInNewComments ? existingNewComments : existingNewComments.concat(newComment)
        // Filter new comments that may already be in the item's comments
        const filteredNewComments = updatedNewComments.filter((comment) => !item.comments.some(existing => existing.id === comment.id))
        return {
          item: {
            ...item,
            newComments: filteredNewComments
          },
        }
      })
    } else {
      client.cache.updateFragment({
        id: `Item:${parentId}`,
        fragmentName: 'ItemWithComments',
        fragment: ITEM_WITH_COMMENTS
      }, (data) => {
        if (!data) return data

        const existingNewComments = data.newComments || []
        const isAlreadyInNewComments = existingNewComments.some(existing => existing.id === newComment.id)
        const updatedNewComments = isAlreadyInNewComments ? existingNewComments : existingNewComments.concat(newComment)
        // Filter new comments that may already be in the item's comments
        const filteredNewComments = updatedNewComments.filter((comment) => !data.comments.some(existing => existing.id === comment.id))
        return {
          ...data,
          newComments: filteredNewComments
        }
      })
    }
  }
}

function findLatestCommentCreatedAt (comments) {
  if (comments.length === 0) return null
  let latest = comments[0].createdAt
  for (const comment of comments) {
    if (comment.createdAt > latest) {
      latest = comment.createdAt
    }
  }
  return latest
}
