import { gql, useApolloClient, useLazyQuery } from '@apollo/client'
import { useState } from 'react'
import Comment, { CommentSkeleton } from './comment'
import styles from './header.module.css'
import { Nav, Navbar } from 'react-bootstrap'
import { COMMENTS_QUERY } from '../fragments/items'
import { COMMENTS } from '../fragments/comments'
import { abbrNum } from '../lib/format'
import { defaultCommentSort } from '../lib/item'

export function CommentsHeader ({ handleSort, pinned, bio, parentCreatedAt, commentSats }) {
  const [sort, setSort] = useState(defaultCommentSort(pinned, bio, parentCreatedAt))

  const getHandleClick = sort => {
    return () => {
      setSort(sort)
      handleSort(sort)
    }
  }

  return (
    <Navbar className='pt-1 pb-0'>
      <Nav
        className={styles.navbarNav}
        activeKey={sort}
      >
        <Nav.Item className='text-muted'>
          {abbrNum(commentSats)} sats
        </Nav.Item>
        <div className='ml-auto d-flex'>
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

export default function Comments ({ parentId, pinned, bio, parentCreatedAt, commentSats, comments, ...props }) {
  const client = useApolloClient()

  const [loading, setLoading] = useState()
  const [getComments] = useLazyQuery(COMMENTS_QUERY, {
    fetchPolicy: 'cache-first',
    onCompleted: data => {
      client.writeFragment({
        id: `Item:${parentId}`,
        fragment: gql`
          ${COMMENTS}
          fragment Comments on Item {
            comments {
              ...CommentsRecursive
            }
          }
        `,
        fragmentName: 'Comments',
        data: {
          comments: data.comments
        }
      })
      setLoading(false)
    }
  })

  return (
    <>
      {comments.length
        ? <CommentsHeader
            commentSats={commentSats} parentCreatedAt={parentCreatedAt}
            pinned={pinned} bio={bio} handleSort={sort => {
              setLoading(true)
              getComments({ variables: { id: parentId, sort } })
            }}
          />
        : null}
      {loading
        ? <CommentsSkeleton />
        : comments.map(item => (
          <Comment depth={1} key={item.id} item={item} {...props} />
        ))}
    </>
  )
}

export function CommentsSkeleton () {
  return <CommentSkeleton skeletonChildren={7} />
}
