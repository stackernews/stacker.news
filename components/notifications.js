import { useApolloClient, useQuery } from '@apollo/client'
import Button from 'react-bootstrap/Button'
import { useState } from 'react'
import Comment, { CommentSkeleton } from './comment'
import Item from './item'
import { NOTIFICATIONS } from '../fragments/notifications'
import styles from './notifications.module.css'
import { useRouter } from 'next/router'

export default function Notifications ({ variables, ...props }) {
  const router = useRouter()
  const client = useApolloClient()
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
        <div
          key={i}
          className={styles.clickToContext}
          onClick={() => {
            if (n.__typename === 'Reply' || !n.item.title) {
              // evict item from cache so that it has current state
              // e.g. if they previously visited before a recent comment
              client.cache.evict({ id: `Item:${n.item.parentId}` })
              router.push({
                pathname: '/items/[id]',
                query: { id: n.item.parentId, commentId: n.item.id }
              }, `/items/${n.item.parentId}`)
            } else {
              client.cache.evict({ id: `Item:${n.item.id}` })
              router.push(`items/${n.item.id}`)
            }
          }}
        >
          {n.__typename === 'Votification' &&
            <small className='font-weight-bold text-success ml-2'>your {n.item.title ? 'post' : 'reply'} stacked {n.earnedSats} sats</small>}
          {n.__typename === 'Mention' &&
            <small className='font-weight-bold text-info ml-2'>you were mentioned in</small>}
          <div className={
            n.__typename === 'Votification' || n.__typename === 'Mention'
              ? `ml-sm-4 ml-2 ${n.item.title ? 'pb-2' : ''}`
              : ''
            }
          >
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
