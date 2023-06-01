import { useState, useCallback, useEffect, useContext, createContext } from 'react'
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
import { RootProvider } from './root'
import { useMe } from './me'

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
  console.error("__typename not supported:", n.__typename)
  return null
}

function NotificationLayout({ children, onClick }) {
  return (
    <div className='clickToContext' onClick={(e) => {
      if (ignoreClick(e)) return
      onClick?.(e)
    }}>
      {children}
    </div>
  )
}

const defaultOnClick = (n) => () => {
  if (!n.item.title) {
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

function EarnNotification({ n }) {
  return (
    <NotificationLayout>
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
    </NotificationLayout>
  );
}

function Invitification({ n }) {
  const router = useRouter()
  return (
    <NotificationLayout onClick={() => router.push('/invites')}>
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
    </NotificationLayout>
  )
}

function InvoicePaid({ n }) {
  const router = useRouter()
  return (
    <NotificationLayout onClick={() => router.push(`/invoices/${n.invoice.id}`)}>
      <div className='font-weight-bold text-info ml-2 py-1'>
        <Check className='fill-info mr-1' />{n.earnedSats} sats were deposited in your account
        <small className='text-muted ml-1'>{timeSince(new Date(n.sortTime))}</small>
      </div>
    </NotificationLayout>
  )
}

function Referral({ n }) {
  return (
    <NotificationLayout>
      <small className='font-weight-bold text-secondary ml-2'>
        someone joined via one of your <Link href='/referrals/month' passHref><a className='text-reset'>referral links</a></Link>
        <small className='text-muted ml-1'>{timeSince(new Date(n.sortTime))}</small>
      </small>
    </NotificationLayout>
  )
}

function Votification({ n }) {
  return (
    <NotificationLayout onClick={defaultOnClick(n)}>
      <small className='font-weight-bold text-success ml-2'>
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
          )
        }
      </div>
    </NotificationLayout>
  )
}

function Mention({ n }) {
  return (
    <NotificationLayout onClick={defaultOnClick(n)}>
      <small className='font-weight-bold text-info ml-2'>
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
          </div>)
        }
      </div>
    </NotificationLayout>
  )
}

function JobChanged({ n }) {
  return (
    <NotificationLayout onClick={defaultOnClick(n)}>
      <small className={`font-weight-bold text-${n.item.status === 'ACTIVE' ? 'success' : 'boost'} ml-1`}>
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

function Reply({ n }) {
  return (
    <NotificationLayout onClick={defaultOnClick(n)} rootText='replying on:'>
      <div className="py-2">
        {n.item.title
          ? <Item item={n.item} />
          : (
            <div className='pb-2'>
              <RootProvider root={n.item.root}>
                <Comment item={n.item} noReply includeParent clickToContext rootText='replying on:' />
              </RootProvider>
            </div>
          )
        }
      </div>
    </NotificationLayout>
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

const NotificationContext = createContext({})

export const NotificationProvider = ({ children }) => {
  const isBrowser = typeof window !== 'undefined'
  const [isSupported] = useState(isBrowser ? 'Notification' in window : false)
  const [isDefaultPermission, setIsDefaultPermission] = useState(isSupported ? window.Notification.permission === 'default' : undefined)
  const [isGranted, setIsGranted] = useState(isSupported ? window.Notification.permission === 'granted' : undefined)
  const me = useMe()

  const show_ = (title, options) => {
    const icon = '/android-chrome-24x24.png'
    new window.Notification(title, { icon, ...options })
  }

  const show = useCallback((...args) => {
    if (!isGranted) return
    show_(...args)
  }, [isGranted])

  const requestPermission = useCallback(() => {
    window.Notification.requestPermission().then(result => {
      setIsDefaultPermission(window.Notification.permission === 'default')
      if (result === 'granted') {
        setIsGranted(result === 'granted')
        show_('you have enabled notifications')
      }
    })
  }, [isDefaultPermission])

  useEffect(() => {
    if (!me || !isSupported || !isDefaultPermission) return
    requestPermission()
  }, [])

  const ctx = { isBrowser, isSupported, isDefaultPermission, isGranted, show }

  return <NotificationContext.Provider value={ctx}>{children}</NotificationContext.Provider>
}

export function useNotification () {
  return useContext(NotificationContext)
}
