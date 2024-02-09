import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@apollo/client'
import Comment, { CommentSkeleton } from './comment'
import Item from './item'
import ItemJob from './item-job'
import { NOTIFICATIONS } from '../fragments/notifications'
import MoreFooter from './more-footer'
import Invite from './invite'
import { ignoreClick } from '../lib/clicks'
import { dayMonthYear, timeSince } from '../lib/time'
import Link from 'next/link'
import Check from '../svgs/check-double-line.svg'
import HandCoin from '../svgs/hand-coin-fill.svg'
import { LOST_BLURBS, FOUND_BLURBS } from '../lib/constants'
import CowboyHatIcon from '../svgs/cowboy.svg'
import BaldIcon from '../svgs/bald.svg'
import { RootProvider } from './root'
import Alert from 'react-bootstrap/Alert'
import styles from './notifications.module.css'
import { useServiceWorker } from './serviceworker'
import { Checkbox, Form } from './form'
import { useRouter } from 'next/router'
import { useData } from './use-data'
import { nostrZapDetails } from '../lib/nostr'
import Text from './text'
import NostrIcon from '../svgs/nostr.svg'
import { numWithUnits } from '../lib/format'
import BountyIcon from '../svgs/bounty-bag.svg'
import { LongCountdown } from './countdown'
import { nextBillingWithGrace } from '../lib/territory'
import { commentSubTreeRootId } from '../lib/item'

function Notification ({ n, fresh }) {
  const type = n.__typename

  return (
    <NotificationLayout nid={nid(n)} {...defaultOnClick(n)} fresh={fresh}>
      {
        (type === 'Earn' && <EarnNotification n={n} />) ||
        (type === 'Revenue' && <RevenueNotification n={n} />) ||
        (type === 'Invitification' && <Invitification n={n} />) ||
        (type === 'InvoicePaid' && (n.invoice.nostr ? <NostrZap n={n} /> : <InvoicePaid n={n} />)) ||
        (type === 'Referral' && <Referral n={n} />) ||
        (type === 'Streak' && <Streak n={n} />) ||
        (type === 'Votification' && <Votification n={n} />) ||
        (type === 'ForwardedVotification' && <ForwardedVotification n={n} />) ||
        (type === 'Mention' && <Mention n={n} />) ||
        (type === 'JobChanged' && <JobChanged n={n} />) ||
        (type === 'Reply' && <Reply n={n} />) ||
        (type === 'SubStatus' && <SubStatus n={n} />) ||
        (type === 'FollowActivity' && <FollowActivity n={n} />) ||
        (type === 'TerritoryPost' && <TerritoryPost n={n} />)
      }
    </NotificationLayout>
  )
}

function NotificationLayout ({ children, nid, href, as, fresh }) {
  const router = useRouter()
  if (!href) return <div className={fresh ? styles.fresh : ''}>{children}</div>
  return (
    <div
      className={
        `clickToContext ${fresh ? styles.fresh : ''} ${router?.query?.nid === nid ? 'outline-it' : ''}`
      }
      onClick={async (e) => {
        if (ignoreClick(e)) return
        nid && await router.replace({
          pathname: router.pathname,
          query: {
            ...router.query,
            nid
          }
        }, router.asPath, { ...router.options, shallow: true })
        router.push(href, as)
      }}
    >
      {children}
    </div>
  )
}

const defaultOnClick = n => {
  const type = n.__typename
  if (type === 'Earn') {
    let href = '/rewards/'
    if (n.minSortTime !== n.sortTime) {
      href += `${dayMonthYear(new Date(n.minSortTime))}/`
    }
    href += dayMonthYear(new Date(n.sortTime))
    return { href }
  }
  if (type === 'Revenue') return { href: `/~${n.subName}` }
  if (type === 'SubStatus') return { href: `/~${n.sub.name}` }
  if (type === 'Invitification') return { href: '/invites' }
  if (type === 'InvoicePaid') return { href: `/invoices/${n.invoice.id}` }
  if (type === 'Referral') return { href: '/referrals/month' }
  if (type === 'Streak') return {}

  // Votification, Mention, JobChanged, Reply all have item
  if (!n.item.title) {
    const rootId = commentSubTreeRootId(n.item)
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
        query: { id: n.item.id }
      },
      as: `/items/${n.item.id}`
    }
  }
}

function Streak ({ n }) {
  function blurb (n) {
    const index = Number(n.id) % Math.min(FOUND_BLURBS.length, LOST_BLURBS.length)
    if (n.days) {
      return `After ${numWithUnits(n.days, {
        abbreviate: false,
        unitSingular: 'day',
         unitPlural: 'days'
      })}, ` + LOST_BLURBS[index]
    }

    return FOUND_BLURBS[index]
  }

  return (
    <div className='d-flex ms-2 py-1'>
      <div style={{ fontSize: '2rem' }}>{n.days ? <BaldIcon className='fill-grey' height={40} width={40} /> : <CowboyHatIcon className='fill-grey' height={40} width={40} />}</div>
      <div className='ms-1 p-1'>
        <span className='fw-bold'>you {n.days ? 'lost your' : 'found a'} cowboy hat</span>
        <div><small style={{ lineHeight: '140%', display: 'inline-block' }}>{blurb(n)}</small></div>
      </div>
    </div>
  )
}

function EarnNotification ({ n }) {
  const time = n.minSortTime === n.sortTime ? dayMonthYear(new Date(n.minSortTime)) : `${dayMonthYear(new Date(n.minSortTime))} to ${dayMonthYear(new Date(n.sortTime))}`

  return (
    <div className='d-flex ms-2 py-1'>
      <HandCoin className='align-self-center fill-boost mx-1' width={24} height={24} style={{ flex: '0 0 24px', transform: 'rotateY(180deg)' }} />
      <div className='ms-2'>
        <div className='fw-bold text-boost'>
          you stacked {numWithUnits(n.earnedSats, { abbreviate: false })} in rewards<small className='text-muted ms-1 fw-normal' suppressHydrationWarning>{time}</small>
        </div>
        {n.sources &&
          <div style={{ fontSize: '80%', color: 'var(--theme-grey)' }}>
            {n.sources.posts > 0 && <span>{numWithUnits(n.sources.posts, { abbreviate: false })} for top posts</span>}
            {n.sources.comments > 0 && <span>{n.sources.posts > 0 && ' \\ '}{numWithUnits(n.sources.comments, { abbreviate: false })} for top comments</span>}
            {n.sources.tipPosts > 0 && <span>{(n.sources.comments > 0 || n.sources.posts > 0) && ' \\ '}{numWithUnits(n.sources.tipPosts, { abbreviate: false })} for zapping top posts early</span>}
            {n.sources.tipComments > 0 && <span>{(n.sources.comments > 0 || n.sources.posts > 0 || n.sources.tipPosts > 0) && ' \\ '}{numWithUnits(n.sources.tipComments, { abbreviate: false })} for zapping top comments early</span>}
          </div>}
        <div style={{ lineHeight: '140%' }}>
          SN distributes the sats it earns back to its best stackers daily. These sats come from <Link href='/~jobs'>jobs</Link>, boosts, posting fees, and donations. You can see the daily rewards pool and make a donation <Link href='/rewards'>here</Link>.
        </div>
        <small className='text-muted ms-1 pb-1 fw-normal'>click for details</small>
      </div>
    </div>
  )
}

function RevenueNotification ({ n }) {
  return (
    <div className='d-flex ms-2 py-1'>
      <BountyIcon className='align-self-center fill-success mx-1' width={24} height={24} style={{ flex: '0 0 24px' }} />
      <div className='ms-2 pb-1'>
        <div className='fw-bold text-success'>
          you stacked {numWithUnits(n.earnedSats, { abbreviate: false })} in territory revenue<small className='text-muted ms-1 fw-normal' suppressHydrationWarning>{timeSince(new Date(n.sortTime))}</small>
        </div>
        <div style={{ lineHeight: '140%' }}>
          As the founder of territory <Link href={`/~${n.subName}`}>~{n.subName}</Link>, you receive 50% of the revenue it generates and the other 50% go to <Link href='/rewards'>rewards</Link>.
        </div>
      </div>
    </div>
  )
}

function SubStatus ({ n }) {
  const dueDate = nextBillingWithGrace(n.sub)
  return (
    <div className={`fw-bold text-${n.sub.status === 'ACTIVE' ? 'success' : 'danger'} ms-2`}>
      {n.sub.status === 'ACTIVE'
        ? 'your territory is active again'
        : (n.sub.status === 'GRACE'
            ? <>your territory payment for ~{n.sub.name} is due or your territory will be archived in <LongCountdown date={dueDate} /></>
            : <>your territory ~{n.sub.name} has been archived</>)}
      <small className='text-muted d-block pb-1 fw-normal'>click to visit territory and pay</small>
    </div>
  )
}

function Invitification ({ n }) {
  return (
    <>
      <small className='fw-bold text-secondary ms-2'>
        your invite has been redeemed by
        {numWithUnits(n.invite.invitees.length, {
          abbreviate: false,
          unitSingular: 'stacker',
          unitPlural: 'stackers'
        })}
      </small>
      <div className='ms-4 me-2 mt-1'>
        <Invite
          invite={n.invite} active={
          !n.invite.revoked &&
          !(n.invite.limit && n.invite.invitees.length >= n.invite.limit)
        }
        />
      </div>
    </>
  )
}

function NostrZap ({ n }) {
  const { nostr } = n.invoice
  const { npub, content, note } = nostrZapDetails(nostr)

  return (
    <>
      <div className='fw-bold text-nostr ms-2 py-1'>
        <NostrIcon width={24} height={24} className='fill-nostr me-1' />{numWithUnits(n.earnedSats)} zap from
        <Link className='mx-1 text-reset text-underline' target='_blank' href={`https://snort.social/p/${npub}`} rel='noreferrer'>
          {npub.slice(0, 10)}...
        </Link>
        on {note
          ? (
            <Link className='mx-1 text-reset text-underline' target='_blank' href={`https://snort.social/e/${note}`} rel='noreferrer'>
              {note.slice(0, 12)}...
            </Link>)
          : 'nostr'}
        <small className='text-muted ms-1 fw-normal' suppressHydrationWarning>{timeSince(new Date(n.sortTime))}</small>
        {content && <small className='d-block ms-4 ps-1 mt-1 mb-1 text-muted fw-normal'><Text>{content}</Text></small>}
      </div>
    </>
  )
}

function InvoicePaid ({ n }) {
  let payerSig
  if (n.invoice.lud18Data) {
    const { name, identifier, email, pubkey } = n.invoice.lud18Data
    const id = identifier || email || pubkey
    payerSig = '- '
    if (name) {
      payerSig += name
      if (id) payerSig += ' \\ '
    }

    if (id) payerSig += id
  }
  return (
    <div className='fw-bold text-info ms-2 py-1'>
      <Check className='fill-info me-1' />{numWithUnits(n.earnedSats, { abbreviate: false, unitSingular: 'sat was', unitPlural: 'sats were' })} deposited in your account
      <small className='text-muted ms-1 fw-normal' suppressHydrationWarning>{timeSince(new Date(n.sortTime))}</small>
      {n.invoice.comment &&
        <small className='d-block ms-4 ps-1 mt-1 mb-1 text-muted fw-normal'>
          <Text>{n.invoice.comment}</Text>
          {payerSig}
        </small>}
    </div>
  )
}

function Referral ({ n }) {
  return (
    <small className='fw-bold text-secondary ms-2'>
      someone joined via one of your referral links
      <small className='text-muted ms-1 fw-normal' suppressHydrationWarning>{timeSince(new Date(n.sortTime))}</small>
    </small>
  )
}

function Votification ({ n }) {
  let forwardedSats = 0
  let ForwardedUsers = null
  if (n.item.forwards?.length) {
    forwardedSats = Math.floor(n.earnedSats * n.item.forwards.map(fwd => fwd.pct).reduce((sum, cur) => sum + cur) / 100)
    ForwardedUsers = () => n.item.forwards.map((fwd, i) =>
      <span key={fwd.user.name}>
        <Link className='text-success' href={`/${fwd.user.name}`}>
          @{fwd.user.name}
        </Link>
        {i !== n.item.forwards.length - 1 && ' '}
      </span>)
  }
  return (
    <>
      <small className='fw-bold text-success d-inline-block ms-2 my-1' style={{ lineHeight: '1.25' }}>
        your {n.item.title ? 'post' : 'reply'} stacked {numWithUnits(n.earnedSats, { abbreviate: false })}
        {n.item.forwards?.length > 0 &&
          <>
            {' '}and forwarded {numWithUnits(forwardedSats, { abbreviate: false })} to{' '}
            <ForwardedUsers />
          </>}
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
    </>
  )
}

function ForwardedVotification ({ n }) {
  return (
    <>
      <small className='fw-bold text-success d-inline-block ms-2 my-1' style={{ lineHeight: '1.25' }}>
        you were forwarded {numWithUnits(n.earnedSats, { abbreviate: false })} from
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
    </>
  )
}

function Mention ({ n }) {
  return (
    <>
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
    </>
  )
}

function JobChanged ({ n }) {
  return (
    <>
      <small className={`fw-bold text-${n.item.status === 'ACTIVE' ? 'success' : 'boost'} ms-1`}>
        {n.item.status === 'ACTIVE'
          ? 'your job is active again'
          : (n.item.status === 'NOSATS'
              ? 'your job promotion ran out of sats'
              : 'your job has been stopped')}
      </small>
      <ItemJob item={n.item} />
    </>
  )
}

function Reply ({ n }) {
  return (
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
  )
}

function FollowActivity ({ n }) {
  return (
    <>
      <small className='fw-bold text-info ms-2'>
        a stacker you subscribe to {n.item.parentId ? 'commented' : 'posted'}
      </small>
      {n.item.title
        ? <div className='ms-2'><Item item={n.item} /></div>
        : (
          <div className='pb-2'>
            <RootProvider root={n.item.root}>
              <Comment item={n.item} noReply includeParent clickToContext rootText='replying on:' />
            </RootProvider>
          </div>
          )}
    </>
  )
}

function TerritoryPost ({ n }) {
  return (
    <>
      <small className='fw-bold text-info ms-2'>
        new post in ~{n.item.sub.name}
      </small>
      <div>
        <Item item={n.item} />
      </div>
    </>
  )
}

export function NotificationAlert () {
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

const nid = n => n.__typename + n.id + n.sortTime

export default function Notifications ({ ssrData }) {
  const { data, fetchMore } = useQuery(NOTIFICATIONS)
  const router = useRouter()
  const dat = useData(data, ssrData)

  const { notifications: { notifications, lastChecked, cursor } } = useMemo(() => {
    return dat || { notifications: {} }
  }, [dat])

  useEffect(() => {
    if (lastChecked && !router?.query?.checkedAt) {
      router.replace({
        pathname: router.pathname,
        query: {
          ...router.query,
          nodata: true, // make sure nodata is set so we don't fetch on back/forward
          checkedAt: lastChecked
        }
      }, router.asPath, { ...router.options, shallow: true })
    }
  }, [router, lastChecked])

  if (!dat) return <CommentsFlatSkeleton />

  return (
    <>
      {notifications.map(n =>
        <Notification
          n={n} key={nid(n)}
          fresh={new Date(n.sortTime) > new Date(router?.query?.checkedAt)}
        />)}
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
