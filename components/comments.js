import { gql, useApolloClient, useLazyQuery } from '@apollo/client'
import { useEffect, useState } from 'react'
import Comment, { CommentSkeleton } from './comment'
import styles from './header.module.css'
import { Nav, Navbar } from 'react-bootstrap'
import { COMMENTS_QUERY } from '../fragments/items'
import { COMMENTS } from '../fragments/comments'
import { abbrNum } from '../lib/format'

export function CommentsHeader ({ handleSort, commentSats }) {
  const [sort, setSort] = useState('hot')

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

export default function Comments ({ parentId, commentSats, comments, ...props }) {
  const client = useApolloClient()
  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      try {
        document.querySelector(hash).scrollIntoView({ behavior: 'smooth' })
      } catch {}
    }
  }, [])
  const [loading, setLoading] = useState()
  const [getComments] = useLazyQuery(COMMENTS_QUERY, {
    fetchPolicy: 'network-only',
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
            commentSats={commentSats} handleSort={sort => {
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
