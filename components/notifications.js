import { useQuery } from '@apollo/client'
import Comment, { CommentSkeleton } from './comment'
import Item, { ItemJob } from './item'
import { NOTIFICATIONS } from '../fragments/notifications'
import { useRouter } from 'next/router'
import MoreFooter from './more-footer'
import Invite from './invite'
import { ignoreClick } from '../lib/clicks'
import Link from 'next/link'

function Notification ({ n }) {
  const router = useRouter()
  return (
    <div
      className='clickToContext'
      onClick={e => {
        if (n.__typename === 'Earn') {
          return
        }

        if (ignoreClick(e)) {
          return
        }

        if (n.__typename === 'Invitification') {
          router.push('/invites')
        } else if (!n.item.title) {
          router.push({
            pathname: '/items/[id]',
            query: { id: n.item.root.id, commentId: n.item.id }
          }, `/items/${n.item.root.id}`)
        } else {
          router.push({
            pathname: '/items/[id]',
            query: { id: n.item.id }
          }, `/items/${n.item.id}`)
        }
      }}
    >
      {n.__typename === 'Invitification'
        ? (
          <>
            <small className='font-weight-bold text-secondary ml-2'>
              your invite has been redeemed by {n.invite.invitees.length} users
            </small>
            <div className='ml-4 mr-2 mt-1'>
              <Invite
                invite={n.invite} active={
                !n.invite.revoked &&
                !(n.invite.limit && n.invite.invitees.length >= n.invite.limit)
              }
              />
            </div>
          </>
          )
        : n.__typename === 'Earn'
          ? (
            <>
              <div className='font-weight-bold text-boost ml-2'>
                you stacked {n.earnedSats} sats
              </div>
              <div className='ml-4'>
                SN distributes the sats it earns back to its best users daily. These sats come from <Link href='/~jobs' passHref><a>jobs</a></Link>, boost, and posting fees.
              </div>
            </>
            )
          : (
            <>
              {n.__typename === 'Votification' &&
                <small className='font-weight-bold text-success ml-2'>
                  your {n.item.title ? 'post' : 'reply'} stacked {n.earnedSats} sats
                </small>}
              {n.__typename === 'Mention' &&
                <small className='font-weight-bold text-info ml-2'>
                  you were mentioned in
                </small>}
              {n.__typename === 'JobChanged' &&
                <small className={`font-weight-bold text-${n.item.status === 'NOSATS' ? 'danger' : 'success'} ml-1`}>
                  {n.item.status === 'NOSATS'
                    ? 'your job ran out of sats'
                    : 'your job is active again'}
                </small>}
              <div className={n.__typename === 'Votification' || n.__typename === 'Mention' || n.__typename === 'JobChanged' ? '' : 'py-2'}>
                {n.item.maxBid
                  ? <ItemJob item={n.item} />
                  : n.item.title
                    ? <Item item={n.item} />
                    : (
                      <div className='pb-2'>
                        <Comment item={n.item} noReply includeParent rootText={n.__typename === 'Reply' ? 'replying on:' : undefined} clickToContext />
                      </div>)}
              </div>
            </>)}
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
      <div className='fresh'>
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
