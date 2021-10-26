import { useQuery } from '@apollo/client'
import Comment, { CommentSkeleton } from './comment'
import Item from './item'
import { NOTIFICATIONS } from '../fragments/notifications'
import styles from './notifications.module.css'
import { useRouter } from 'next/router'
import MoreFooter from './more-footer'

function Notification ({ n }) {
  const router = useRouter()
  return (
    <div
      className={styles.clickToContext}
      onClick={() => {
        if (n.__typename === 'Reply' || !n.item.title) {
          router.push({
            pathname: '/items/[id]',
            query: { id: n.item.parentId, commentId: n.item.id }
          }, `/items/${n.item.parentId}`)
        } else {
          router.push({
            pathname: '/items/[id]',
            query: { id: n.item.id }
          }, `/items/${n.item.id}`)
        }
      }}
    >
      {n.__typename === 'Votification' &&
        <small className='font-weight-bold text-success ml-2'>your {n.item.title ? 'post' : 'reply'} stacked {n.earnedSats} sats</small>}
      {n.__typename === 'Mention' &&
        <small className='font-weight-bold text-info ml-2'>you were mentioned in</small>}
      <div className={
    n.__typename === 'Votification' || n.__typename === 'Mention'
      ? `ml-sm-4 ml-3 ${n.item.title ? 'pb-2' : ''}`
      : ''
    }
      >
        {n.item.title
          ? <Item item={n.item} />
          : <Comment item={n.item} noReply includeParent rootText={n.__typename === 'Reply' ? 'replying to you on:' : undefined} clickToContext />}
      </div>
    </div>
  )
}

export default function Notifications ({ notifications, cursor, lastChecked, variables }) {
  const { data, fetchMore } = useQuery(NOTIFICATIONS, { variables })

  if (data) {
    ({ notifications: { notifications, cursor } } = data)
  }

  const [fresh, old] =
    notifications.reduce((result, n) => {
      result[new Date(n.sortTime).getTime() > lastChecked ? 0 : 1].push(n)
      return result
    },
    [[], []])

  return (
    <>
      {/* XXX we shouldn't use the index but we don't have a unique id in this union yet */}
      <div className={styles.fresh}>
        {fresh.map((n, i) => (
          <Notification n={n} key={i} />
        ))}
      </div>
      {old.map((n, i) => (
        <Notification n={n} key={i} />
      ))}
      <MoreFooter cursor={cursor} fetchMore={fetchMore} Skeleton={CommentsFlatSkeleton} />
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
