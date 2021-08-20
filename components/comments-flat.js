import { useQuery } from '@apollo/client'
import Button from 'react-bootstrap/Button'
import { MORE_FLAT_COMMENTS } from '../fragments/comments'
import { useState } from 'react'
import Comment, { CommentSkeleton } from './comment'
import styles from './notifications.module.css'
import { useRouter } from 'next/router'

export default function CommentsFlat ({ variables, ...props }) {
  const router = useRouter()
  const { loading, error, data, fetchMore } = useQuery(MORE_FLAT_COMMENTS, {
    variables
  })
  if (error) return <div>Failed to load!</div>
  if (loading) {
    return <CommentsFlatSkeleton />
  }
  const { moreFlatComments: { comments, cursor } } = data
  return (
    <>
      {comments.map(item => (
        <div
          key={item.id}
          className={styles.clickToContext}
          onClick={() => {
            router.push({
              pathname: '/items/[id]',
              query: { id: item.parentId, commentId: item.id }
            }, `/items/${item.parentId}`)
          }}
        >
          <Comment item={item} {...props} />
        </div>
      ))}
      <MoreFooter cursor={cursor} fetchMore={fetchMore} />
    </>
  )
}

function CommentsFlatSkeleton () {
  const comments = new Array(21).fill(null)

  return (
    <div>{comments.map((_, i) => (
      <CommentSkeleton key={i} skeletonChildren={0} />
    ))}
    </div>
  )
}

function MoreFooter ({ cursor, fetchMore }) {
  const [loading, setLoading] = useState(false)

  if (loading) {
    return <div><CommentsFlatSkeleton /></div>
  }

  let Footer
  if (cursor) {
    Footer = () => (
      <Button
        variant='primary'
        size='md'
        onClick={async () => {
          setLoading(true)
          await fetchMore({
            variables: {
              cursor
            }
          })
          setLoading(false)
        }}
      >more
      </Button>
    )
  } else {
    Footer = () => (
      <div className='text-muted' style={{ fontFamily: 'lightning', fontSize: '2rem', opacity: '0.6' }}>GENISIS</div>
    )
  }

  return <div className='d-flex justify-content-center mt-4 mb-2'><Footer /></div>
}
