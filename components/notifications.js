import { useQuery } from '@apollo/client'
import Button from 'react-bootstrap/Button'
import { useState } from 'react'
import Comment, { CommentSkeleton } from './comment'
import Item from './item'
import { NOTIFICATIONS } from '../fragments/notifications'

export default function Notifications ({ variables, ...props }) {
  const { loading, error, data, fetchMore } = useQuery(NOTIFICATIONS, {
    variables
  })
  if (error) return <div>Failed to load!</div>
  if (loading) {
    return <CommentsFlatSkeleton />
  }
  const { notifications: { notifications, cursor } } = data
  return (
    <>
      {/* XXX we shouldn't use the index but we don't have a unique id in this union yet */}
      {notifications.map((n, i) => (
        <div key={i}>
          {n.__typename === 'Votification' && <small className='font-weight-bold text-success'>your {n.item.title ? 'post' : 'reply'} stacked {n.earnedSats} sats</small>}
          <div className={n.__typename === 'Votification' ? 'ml-sm-4 ml-2' : ''}>
            {n.item.title
              ? <Item item={n.item} />
              : <Comment item={n.item} noReply includeParent rootText={n.__typename === 'Reply' ? 'replying to you on:' : undefined} clickToContext {...props} />}
          </div>
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
