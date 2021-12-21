import { gql, useApolloClient, useLazyQuery, useQuery } from '@apollo/client'
import { useEffect, useState } from 'react'
import Comment, { CommentSkeleton } from './comment'
import styles from './header.module.css'
import { Nav, Navbar } from 'react-bootstrap'
import { COMMENTS_QUERY } from '../fragments/items'
import { COMMENTS } from '../fragments/comments'

export function CommentsHeader ({ handleSort }) {
  const [sort, setSort] = useState('hot')

  const getHandleClick = sort => {
    return () => {
      setSort(sort)
      handleSort(sort)
    }
  }

  return (
    <Navbar className='py-0'>
      <Nav
        className={styles.navbarNav}
        activeKey={sort}
      >
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
      </Nav>
    </Navbar>
  )
}

export default function Comments ({ parentId, comments, ...props }) {
  const client = useApolloClient()
  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      document.querySelector(hash).scrollIntoView({ behavior: 'smooth' })
    }
  }, [])
  const [getComments, { loading }] = useLazyQuery(COMMENTS_QUERY, {
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
    }
  })

  return (
    <>
      {comments.length ? <CommentsHeader handleSort={sort => getComments({ variables: { id: parentId, sort } })} /> : null}
      {loading
        ? <CommentsSkeleton />
        : comments.map(item => (
          <Comment key={item.id} item={item} {...props} />
        ))}
    </>
  )
}

export function CommentsSkeleton () {
  return <CommentSkeleton skeletonChildren={7} />
}

export function CommentsQuery ({ query, ...props }) {
  const { error, data } = useQuery(query)

  if (error) return <div>Failed to load!</div>
  if (!data) {
    return <CommentsSkeleton />
  }

  return <Comments comments={data.comments} {...props} />
}
