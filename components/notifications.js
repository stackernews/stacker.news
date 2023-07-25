import { useState, useEffect, useMemo } from 'react'
import { useApolloClient, useQuery } from '@apollo/client'
import Comment, { CommentSkeleton } from './comment'
import Item from './item'
import ItemJob from './item-job'
import { HAS_NOTIFICATIONS, NOTIFICATIONS } from '../fragments/notifications'
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
import { RootProvider } from './root'
import Alert from 'react-bootstrap/Alert'
import styles from './notifications.module.css'
import { useServiceWorker } from './serviceworker'
import { Checkbox, Form } from './form'
import { useRouter } from 'next/router'

function Notification ({ n }) {
  switch (n.__typename) {
    case 'Earn': return <EarnNotification n={n} />
    case 'Invitification': return <Invitification n={n} />
    case 'InvoicePaid': return <InvoicePaid n={n} />
    case 'Referral': return <Referral n={n} />
    case 'Streak': return <Streak n={n} />
    case 'Votification': return <Votification n={n} />
    case 'Mention': return <Mention n={n} />
    case 'JobChanged': return <JobChanged n={n} />
    case 'Reply': return <Reply n={n} />
  }
  console.error('__typename not supported:', n.__typename)
  return null
}

function NotificationLayout ({ children, href, as }) {
  const router = useRouter()
  return (
    <div
      className='clickToContext'
      onClick={(e) => !ignoreClick(e) && router.push(href, as)}
    >
      {children}
    </div>
  )
}

const defaultOnClick = n => {
  if (!n.item.title) {
    const path = n.item.path.split('.')
    if (path.length > COMMENT_DEPTH_LIMIT + 1) {
      const rootId = path.slice(-(COMMENT_DEPTH_LIMIT + 1))[0]
      return {
        href: {
          pathname: '/items/[id]',
          query: { id: rootId, commentId: n.item.id }
        },
        as: `/items/${rootId}`
      }
    } else {
      return {
        href: {
          pathname: '/items/[id]',
          query: { id: n.item.root.id, commentId: n.item.id }
        },
        as: `/items/${n.item.root.id}`
      }
    }
  } else {
    return {
      href: {
        pathname: '/items/[id]',
        query: { id: n.item.id }
      },
      as: `/items/${n.item.id}`
    }
  }
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
    <div className='d-flex fw-bold ms-2 py-1'>
      <div style={{ fontSize: '2rem' }}>{n.days ? <BaldIcon className='fill-grey' height={40} width={40} /> : <CowboyHatIcon className='fill-grey' height={40} width={40} />}</div>
      <div className='ms-1 p-1'>
        you {n.days ? 'lost your' : 'found a'} cowboy hat
        <div><small style={{ lineHeight: '140%', display: 'inline-block' }}>{blurb(n)}</small></div>
      </div>
    </div>
  )
}

function EarnNotification ({ n }) {
  return (
    <div className='d-flex ms-2 py-1'>
      <HandCoin className='align-self-center fill-boost mx-1' width={24} height={24} style={{ flex: '0 0 24px', transform: 'rotateY(180deg)' }} />
      <div className='ms-2'>
        <div className='fw-bold text-boost'>
          you stacked {n.earnedSats} sats in rewards<small className='text-muted ms-1'>{timeSince(new Date(n.sortTime))}</small>
        </div>
        {n.sources &&
          <div style={{ fontSize: '80%', color: 'var(--theme-grey)' }}>
            {n.sources.posts > 0 && <span>{n.sources.posts} sats for top posts</span>}
            {n.sources.comments > 0 && <span>{n.sources.posts > 0 && ' \\ '}{n.sources.comments} sats for top comments</span>}
            {n.sources.tipPosts > 0 && <span>{(n.sources.comments > 0 || n.sources.posts > 0) && ' \\ '}{n.sources.tipPosts} sats for zapping top posts early</span>}
            {n.sources.tipComments > 0 && <span>{(n.sources.comments > 0 || n.sources.posts > 0 || n.sources.tipPosts > 0) && ' \\ '}{n.sources.tipComments} sats for zapping top comments early</span>}
          </div>}
        <div className='pb-1' style={{ lineHeight: '140%' }}>
          SN distributes the sats it earns back to its best stackers daily. These sats come from <Link href='/~jobs'>jobs</Link>, boosts, posting fees, and donations. You can see the daily rewards pool and make a donation <Link href='/rewards'>here</Link>.
        </div>
      </div>
    </div>
  )
}

function Invitification ({ n }) {
  return (
    <NotificationLayout href='/invites'>
      <small className='fw-bold text-secondary ms-2'>
        your invite has been redeemed by {n.invite.invitees.length} stackers
      </small>
      <div className='ms-4 me-2 mt-1'>
        <Invite
          invite={n.invite} active={
          !n.invite.revoked &&
          !(n.invite.limit && n.invite.invitees.length >= n.invite.limit)
        }
        />
      </div>
    </NotificationLayout>
  )
}

function InvoicePaid ({ n }) {
  return (
    <NotificationLayout href={`/invoices/${n.invoice.id}`}>
      <div className='fw-bold text-info ms-2 py-1'>
        <Check className='fill-info me-1' />{n.earnedSats} sats were deposited in your account
        <small className='text-muted ms-1'>{timeSince(new Date(n.sortTime))}</small>
      </div>
    </NotificationLayout>
  )
}

function Referral ({ n }) {
  return (
    <NotificationLayout>
      <small className='fw-bold text-secondary ms-2'>
        someone joined via one of your <Link href='/referrals/month' className='text-reset'>referral links</Link>
        <small className='text-muted ms-1'>{timeSince(new Date(n.sortTime))}</small>
      </small>
    </NotificationLayout>
  )
}

function Votification ({ n }) {
  return (
    <NotificationLayout {...defaultOnClick(n)}>
      <small className='fw-bold text-success ms-2'>
        your {n.item.title ? 'post' : 'reply'} {n.item.fwdUser ? 'forwarded' : 'stacked'} {n.earnedSats} sats{n.item.fwdUser && ` to @${n.item.fwdUser.name}`}
      </small>
      <div>
        {n.item.title
          ? <Item item={n.item} />
          : (
            <div className='pb-2'>
              <RootProvider root={n.item.root}>
                <Comment item={n.item} noReply includeParent clickToContext />
              </RootProvider>
            </div>
            )}
      </div>
    </NotificationLayout>
  )
}

function Mention ({ n }) {
  return (
    <NotificationLayout {...defaultOnClick(n)}>
      <small className='fw-bold text-info ms-2'>
        you were mentioned in
      </small>
      <div>
        {n.item.title
          ? <Item item={n.item} />
          : (
            <div className='pb-2'>
              <RootProvider root={n.item.root}>
                <Comment item={n.item} noReply includeParent rootText={n.__typename === 'Reply' ? 'replying on:' : undefined} clickToContext />
              </RootProvider>
            </div>)}
      </div>
    </NotificationLayout>
  )
}

function JobChanged ({ n }) {
  return (
    <NotificationLayout {...defaultOnClick(n)}>
      <small className={`fw-bold text-${n.item.status === 'ACTIVE' ? 'success' : 'boost'} ms-1`}>
        {n.item.status === 'ACTIVE'
          ? 'your job is active again'
          : (n.item.status === 'NOSATS'
              ? 'your job promotion ran out of sats'
              : 'your job has been stopped')}
      </small>
      <ItemJob item={n.item} />
    </NotificationLayout>
  )
}

function Reply ({ n }) {
  return (
    <NotificationLayout {...defaultOnClick(n)} rootText='replying on:'>
      <div className='py-2'>
        {n.item.title
          ? <Item item={n.item} />
          : (
            <div className='pb-2'>
              <RootProvider root={n.item.root}>
                <Comment item={n.item} noReply includeParent clickToContext rootText='replying on:' />
              </RootProvider>
            </div>
            )}
      </div>
    </NotificationLayout>
  )
}

function NotificationAlert () {
  const [showAlert, setShowAlert] = useState(false)
  const [hasSubscription, setHasSubscription] = useState(false)
  const [error, setError] = useState(null)
  const [supported, setSupported] = useState(false)
  const sw = useServiceWorker()

  useEffect(() => {
    const isSupported = sw.support.serviceWorker && sw.support.pushManager && sw.support.notification
    if (isSupported) {
      const isDefaultPermission = sw.permission.notification === 'default'
      setShowAlert(isDefaultPermission && !window.localStorage.getItem('hideNotifyPrompt'))
      sw.registration?.pushManager.getSubscription().then(subscription => setHasSubscription(!!subscription))
      setSupported(true)
    }
  }, [sw])

  const close = () => {
    window.localStorage.setItem('hideNotifyPrompt', 'yep')
    setShowAlert(false)
  }

  return (
    error
      ? (
        <Alert variant='danger' dismissible onClose={() => setError(null)}>
          <span>{error.toString()}</span>
        </Alert>
        )
      : showAlert
        ? (
          <Alert variant='info' dismissible onClose={close}>
            <span className='align-middle'>Enable push notifications?</span>
            <button
              className={`${styles.alertBtn} mx-1`}
              onClick={async () => {
                await sw.requestNotificationPermission()
                  .then(close)
                  .catch(setError)
              }}
            >Yes
            </button>
            <button className={styles.alertBtn} onClick={close}>No</button>
          </Alert>
          )
        : (
          <Form className={`d-flex justify-content-end ${supported ? 'visible' : 'invisible'}`} initial={{ pushNotify: hasSubscription }}>
            <Checkbox
              name='pushNotify' label={<span className='text-muted'>push notifications</span>}
              groupClassName={`${styles.subFormGroup} mb-1 me-sm-3 me-0`}
              inline checked={hasSubscription} handleChange={async () => {
                await sw.togglePushSubscription().catch(setError)
              }}
            />
          </Form>
          )
  )
}

export default function Notifications ({ ssrData }) {
  const { data, fetchMore } = useQuery(NOTIFICATIONS)
  const client = useApolloClient()

  useEffect(() => {
    client.writeQuery({
      query: HAS_NOTIFICATIONS,
      data: {
        hasNewNotes: false
      }
    })
  }, [client])

  const { notifications: { notifications, earn, lastChecked, cursor } } = useMemo(() => {
    if (!data && !ssrData) return { notifications: {} }
    return data || ssrData
  }, [data, ssrData])

  const [fresh, old] = useMemo(() => {
    if (!notifications) return [[], []]
    return notifications.reduce((result, n) => {
      result[new Date(n.sortTime).getTime() > lastChecked ? 0 : 1].push(n)
      return result
    },
    [[], []])
  }, [notifications, lastChecked])

  if (!data && !ssrData) return <CommentsFlatSkeleton />

  return (
    <>
      <NotificationAlert />
      <div className='fresh'>
        {earn && <Notification n={earn} key='earn' />}
        {fresh.map((n, i) => (
          <Notification n={n} key={n.__typename + n.id + n.sortTime} />
        ))}
      </div>
      {old.map((n, i) => (
        <Notification n={n} key={n.__typename + n.id + n.sortTime} />
      ))}
      <MoreFooter cursor={cursor} count={notifications?.length} fetchMore={fetchMore} Skeleton={CommentsFlatSkeleton} noMoreText='NO MORE' />
    </>
  )
}

function CommentsFlatSkeleton () {
  const comments = new Array(21).fill(null)

  return (
    <div>
      {comments.map((_, i) => (
        <CommentSkeleton key={i} skeletonChildren={0} />
      ))}
    </div>
  )
}
