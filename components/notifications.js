import { useQuery } from '@apollo/client'
import Comment, { CommentSkeleton } from './comment'
import Item from './item'
import ItemJob from './item-job'
import { NOTIFICATIONS } from '../fragments/notifications'
import { useRouter } from 'next/router'
import MoreFooter from './more-footer'
import Invite from './invite'
import { ignoreClick } from '../lib/clicks'
import { timeSince } from '../lib/time'
import Link from 'next/link'
import Check from '../svgs/check-double-line.svg'
import HandCoin from '../svgs/hand-coin-fill.svg'
import { COMMENT_DEPTH_LIMIT } from '../lib/constants'
import CowboyHatIcon from '../svgs/cowboy.svg'
import BaldIcon from '../svgs/bald.svg'

// TODO: oh man, this is a mess ... each notification type should just be a component ...
function Notification ({ n }) {
  const router = useRouter()
  return (
    <div
      className='clickToContext'
      onClick={e => {
        if (n.__typename === 'Earn' || n.__typename === 'Referral' || n.__typename === 'Streak') {
          return
        }

        if (ignoreClick(e)) {
          return
        }

        if (n.__typename === 'InvoicePaid') {
          router.push(`/invoices/${n.invoice.id}`)
        } else if (n.__typename === 'Invitification') {
          router.push('/invites')
        } else if (!n.item.title) {
          if (n.item.path.split('.').length > COMMENT_DEPTH_LIMIT + 1) {
            router.push({
              pathname: '/items/[id]',
              query: { id: n.item.parentId, commentId: n.item.id }
            }, `/items/${n.item.parentId}`)
          } else {
            router.push({
              pathname: '/items/[id]',
              query: { id: n.item.root.id, commentId: n.item.id }
            }, `/items/${n.item.root.id}`)
          }
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
            <div className='d-flex'>
              <HandCoin className='align-self-center fill-boost mx-1' width={24} height={24} style={{ flex: '0 0 24px', transform: 'rotateY(180deg)' }} />
              <div className='ml-2'>
                <div className='font-weight-bold text-boost'>
                  you stacked {n.earnedSats} sats in rewards<small className='text-muted ml-1'>{timeSince(new Date(n.sortTime))}</small>
                </div>
                {n.sources &&
                  <div style={{ fontSize: '80%', color: 'var(--theme-grey)' }}>
                    {n.sources.posts > 0 && <span>{n.sources.posts} sats for top posts</span>}
                    {n.sources.comments > 0 && <span>{n.sources.posts > 0 && ' \\ '}{n.sources.comments} sats for top comments</span>}
                    {n.sources.tips > 0 && <span>{(n.sources.comments > 0 || n.sources.posts > 0) && ' \\ '}{n.sources.tips} sats for tipping top content early</span>}
                  </div>}
                <div className='pb-1' style={{ lineHeight: '140%' }}>
                  SN distributes the sats it earns back to its best users daily. These sats come from <Link href='/~jobs' passHref><a>jobs</a></Link>, boosts, posting fees, and donations. You can see the daily rewards pool and make a donation <Link href='/rewards' passHref><a>here</a></Link>.
                </div>
              </div>
            </div>
            )
          : n.__typename === 'Referral'
            ? (
              <>
                <small className='font-weight-bold text-secondary ml-2'>
                  someone joined via one of your <Link href='/referrals/month' passHref><a className='text-reset'>referral links</a></Link>
                  <small className='text-muted ml-1'>{timeSince(new Date(n.sortTime))}</small>
                </small>
              </>
              )
            : n.__typename === 'InvoicePaid'
              ? (
                <div className='font-weight-bold text-info ml-2 py-1'>
                  <Check className='fill-info mr-1' />{n.earnedSats} sats were deposited in your account
                  <small className='text-muted ml-1'>{timeSince(new Date(n.sortTime))}</small>
                </div>)
              : n.__typename === 'Streak'
                ? <Streak n={n} />
                : (
                  <>
                    {n.__typename === 'Votification' &&
                      <small className='font-weight-bold text-success ml-2'>
                        your {n.item.title ? 'post' : 'reply'} {n.item.fwdUser ? 'forwarded' : 'stacked'} {n.earnedSats} sats{n.item.fwdUser && ` to @${n.item.fwdUser.name}`}
                      </small>}
                    {n.__typename === 'Mention' &&
                      <small className='font-weight-bold text-info ml-2'>
                        you were mentioned in
                      </small>}
                    {n.__typename === 'JobChanged' &&
                      <small className={`font-weight-bold text-${n.item.status === 'ACTIVE' ? 'success' : 'boost'} ml-1`}>
                        {n.item.status === 'ACTIVE'
                          ? 'your job is active again'
                          : (n.item.status === 'NOSATS'
                              ? 'your job promotion ran out of sats'
                              : 'your job has been stopped')}
                      </small>}
                    <div className={n.__typename === 'Votification' || n.__typename === 'Mention' || n.__typename === 'JobChanged' ? '' : 'py-2'}>
                      {n.item.isJob
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

function Streak ({ n }) {
  function blurb (n) {
    const index = Number(n.id) % 6
    const FOUND_BLURBS = [
      'The harsh frontier is no place for the unprepared. This hat will protect you from the sun, dust, and other elements Mother Nature throws your way.',
      'A cowboy is nothing without a cowboy hat. Take good care of it, and it will protect you from the sun, dust, and other elements on your journey.',
      "This is not just a hat, it's a matter of survival. Take care of this essential tool, and it will shield you from the scorching sun and the elements.",
      "A cowboy hat isn't just a fashion statement. It's your last defense against the unforgiving elements of the Wild West. Hang onto it tight.",
      "A good cowboy hat is worth its weight in gold, shielding you from the sun, wind, and dust of the western frontier. Don't lose it.",
      'Your cowboy hat is the key to your survival in the wild west. Treat it with respect and it will protect you from the elements.'
    ]

    const LOST_BLURBS = [
      'your cowboy hat was taken by the wind storm that blew in from the west. No worries, a true cowboy always finds another hat.',
      "you left your trusty cowboy hat in the saloon before leaving town. You'll need a replacement for the long journey west.",
      'you lost your cowboy hat in a wild shoot-out on the outskirts of town. Tough luck, tIme to start searching for another one.',
      'you ran out of food and had to trade your hat for supplies. Better start looking for another hat.',
      "your hat was stolen by a mischievous prairie dog. You won't catch the dog, but you can always find another hat.",
      'you lost your hat while crossing the river on your journey west. Maybe you can find a replacement hat in the next town.'
    ]

    if (n.days) {
      return `After ${n.days} days, ` + LOST_BLURBS[index]
    }

    return FOUND_BLURBS[index]
  }

  return (
    <div className='d-flex font-weight-bold ml-2 py-1'>
      <div style={{ fontSize: '2rem' }}>{n.days ? <BaldIcon className='fill-grey' height={40} width={40} /> : <CowboyHatIcon className='fill-grey' height={40} width={40} />}</div>
      <div className='ml-1 p-1'>
        you {n.days ? 'lost your' : 'found a'} cowboy hat
        <div><small style={{ lineHeight: '140%', display: 'inline-block' }}>{blurb(n)}</small></div>
      </div>
    </div>
  )
}

export default function Notifications ({ notifications, earn, cursor, lastChecked, variables }) {
  const { data, fetchMore } = useQuery(NOTIFICATIONS, { variables })

  if (data) {
    ({ notifications: { notifications, earn, cursor } } = data)
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
        {earn && <Notification n={earn} key='earn' />}
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
