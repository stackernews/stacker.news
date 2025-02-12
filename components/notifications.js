import { useState, useEffect, useMemo } from 'react'
import { gql, useQuery } from '@apollo/client'
import Comment, { CommentSkeleton } from './comment'
import Item from './item'
import ItemJob from './item-job'
import { NOTIFICATIONS } from '@/fragments/notifications'
import MoreFooter from './more-footer'
import Invite from './invite'
import { dayMonthYear, timeSince } from '@/lib/time'
import Link from 'next/link'
import Check from '@/svgs/check-double-line.svg'
import HandCoin from '@/svgs/hand-coin-fill.svg'
import UserAdd from '@/svgs/user-add-fill.svg'
import { LOST_BLURBS, FOUND_BLURBS, UNKNOWN_LINK_REL } from '@/lib/constants'
import CowboyHatIcon from '@/svgs/cowboy.svg'
import BaldIcon from '@/svgs/bald.svg'
import GunIcon from '@/svgs/revolver.svg'
import HorseIcon from '@/svgs/horse.svg'
import { RootProvider } from './root'
import Alert from 'react-bootstrap/Alert'
import styles from './notifications.module.css'
import { useServiceWorker } from './serviceworker'
import { Checkbox, Form } from './form'
import { useRouter } from 'next/router'
import { useData } from './use-data'
import { nostrZapDetails } from '@/lib/nostr'
import Text from './text'
import NostrIcon from '@/svgs/nostr.svg'
import { numWithUnits } from '@/lib/format'
import BountyIcon from '@/svgs/bounty-bag.svg'
import { LongCountdown } from './countdown'
import { nextBillingWithGrace } from '@/lib/territory'
import { commentSubTreeRootId } from '@/lib/item'
import LinkToContext from './link-to-context'
import { Badge, Button } from 'react-bootstrap'
import { useAct } from './item-act'
import { RETRY_PAID_ACTION } from '@/fragments/paidAction'
import { usePollVote } from './poll'
import { paidActionCacheMods } from './use-paid-mutation'
import { useRetryCreateItem } from './use-item-submit'
import { payBountyCacheMods } from './pay-bounty'
import { useToast } from './toast'
import classNames from 'classnames'
import HolsterIcon from '@/svgs/holster.svg'
import SaddleIcon from '@/svgs/saddle.svg'
import CCInfo from './info/cc'
import { useMe } from './me'

function Notification ({ n, fresh }) {
  const type = n.__typename

  return (
    <NotificationLayout nid={nid(n)} type={type} {...defaultOnClick(n)} fresh={fresh}>
      {
        (type === 'Earn' && <EarnNotification n={n} />) ||
        (type === 'Revenue' && <RevenueNotification n={n} />) ||
        (type === 'Invitification' && <Invitification n={n} />) ||
        (type === 'InvoicePaid' && (n.invoice.nostr ? <NostrZap n={n} /> : <InvoicePaid n={n} />)) ||
        (type === 'WithdrawlPaid' && <WithdrawlPaid n={n} />) ||
        (type === 'Referral' && <Referral n={n} />) ||
        (type === 'Streak' && <Streak n={n} />) ||
        (type === 'Votification' && <Votification n={n} />) ||
        (type === 'ForwardedVotification' && <ForwardedVotification n={n} />) ||
        (type === 'Mention' && <Mention n={n} />) ||
        (type === 'ItemMention' && <ItemMention n={n} />) ||
        (type === 'JobChanged' && <JobChanged n={n} />) ||
        (type === 'Reply' && <Reply n={n} />) ||
        (type === 'SubStatus' && <SubStatus n={n} />) ||
        (type === 'FollowActivity' && <FollowActivity n={n} />) ||
        (type === 'TerritoryPost' && <TerritoryPost n={n} />) ||
        (type === 'TerritoryTransfer' && <TerritoryTransfer n={n} />) ||
        (type === 'Reminder' && <Reminder n={n} />) ||
        (type === 'Invoicification' && <Invoicification n={n} />) ||
        (type === 'ReferralReward' && <ReferralReward n={n} />)
      }
    </NotificationLayout>
  )
}

function NotificationLayout ({ children, type, nid, href, as, fresh }) {
  const router = useRouter()
  if (!href) return <div className={`py-2 ${fresh ? styles.fresh : ''}`}>{children}</div>
  return (
    <LinkToContext
      className={`py-2 ${type === 'Reply' ? styles.reply : ''} ${fresh ? styles.fresh : ''} ${router?.query?.nid === nid ? 'outline-it' : ''}`}
      onClick={async (e) => {
        e.preventDefault()
        nid && await router.replace({
          pathname: router.pathname,
          query: {
            ...router.query,
            nid
          }
        }, router.asPath, { ...router.options, shallow: true })
        router.push(href, as)
      }}
      href={href}
    >
      {children}
    </LinkToContext>
  )
}

function NoteHeader ({ color, children, big }) {
  return (
    <div className={`${styles.noteHeader} text-${color} ${big ? '' : 'small'} pb-2`}>
      {children}
    </div>
  )
}

function NoteItem ({ item, ...props }) {
  return (
    <div>
      {item.title
        ? <Item item={item} itemClassName='pt-0' {...props} />
        : (
          <RootProvider root={item.root}>
            <Comment item={item} noReply includeParent clickToContext {...props} />
          </RootProvider>)}
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

  const itemLink = item => {
    if (!item) return {}
    if (item.title) {
      return {
        href: {
          pathname: '/items/[id]',
          query: { id: item.id }
        },
        as: `/items/${item.id}`
      }
    } else {
      const rootId = commentSubTreeRootId(item)
      return {
        href: {
          pathname: '/items/[id]',
          query: { id: rootId, commentId: item.id }
        },
        as: `/items/${rootId}`
      }
    }
  }

  if (type === 'Revenue') return { href: `/~${n.subName}` }
  if (type === 'SubStatus') return { href: `/~${n.sub.name}` }
  if (type === 'Invitification') return { href: '/invites' }
  if (type === 'InvoicePaid') return { href: `/invoices/${n.invoice.id}` }
  if (type === 'Invoicification') return itemLink(n.invoice.item)
  if (type === 'WithdrawlPaid') return { href: `/withdrawals/${n.id}` }
  if (type === 'Referral') return { href: '/referrals/month' }
  if (type === 'ReferralReward') return { href: '/referrals/month' }
  if (type === 'Streak') return {}
  if (type === 'TerritoryTransfer') return { href: `/~${n.sub.name}` }

  if (!n.item) return {}

  // Votification, Mention, JobChanged, Reply all have item
  return itemLink(n.item)
}

function Streak ({ n }) {
  function blurb (n) {
    const type = n.type ?? 'COWBOY_HAT'
    const index = Number(n.id) % Math.min(FOUND_BLURBS[type].length, LOST_BLURBS[type].length)
    if (n.days) {
      return `After ${numWithUnits(n.days, {
        abbreviate: false,
        unitSingular: 'day',
         unitPlural: 'days'
      })}, ` + LOST_BLURBS[type][index]
    }

    return FOUND_BLURBS[type][index]
  }

  const Icon = n.days
    ? n.type === 'GUN' ? HolsterIcon : n.type === 'HORSE' ? SaddleIcon : BaldIcon
    : n.type === 'GUN' ? GunIcon : n.type === 'HORSE' ? HorseIcon : CowboyHatIcon

  return (
    <div className='d-flex'>
      <div style={{ fontSize: '2rem' }}><Icon className='fill-grey' height={40} width={40} /></div>
      <div className='ms-1 p-1'>
        <span className='fw-bold'>you {n.days ? 'lost your' : 'found a'} {n.type.toLowerCase().replace('_', ' ')}</span>
        <div><small style={{ lineHeight: '140%', display: 'inline-block' }}>{blurb(n)}</small></div>
      </div>
    </div>
  )
}

function EarnNotification ({ n }) {
  const time = n.minSortTime === n.sortTime ? dayMonthYear(new Date(n.minSortTime)) : `${dayMonthYear(new Date(n.minSortTime))} to ${dayMonthYear(new Date(n.sortTime))}`

  return (
    <div className='d-flex'>
      <HandCoin className='align-self-center fill-boost mx-1' width={24} height={24} style={{ flex: '0 0 24px', transform: 'rotateY(180deg)' }} />
      <div className='ms-2'>
        <NoteHeader color='boost' big>
          you stacked {numWithUnits(n.earnedSats, { abbreviate: false })} in rewards<small className='text-muted ms-1 fw-normal' suppressHydrationWarning>{time}</small>
        </NoteHeader>
        {n.sources &&
          <div style={{ fontSize: '80%', color: 'var(--theme-grey)' }}>
            {n.sources.posts > 0 && <span>{numWithUnits(n.sources.posts, { abbreviate: false })} for top posts</span>}
            {n.sources.comments > 0 && <span>{n.sources.posts > 0 && ' \\ '}{numWithUnits(n.sources.comments, { abbreviate: false })} for top comments</span>}
            {n.sources.tipPosts > 0 && <span>{(n.sources.comments > 0 || n.sources.posts > 0) && ' \\ '}{numWithUnits(n.sources.tipPosts, { abbreviate: false })} for zapping top posts early</span>}
            {n.sources.tipComments > 0 && <span>{(n.sources.comments > 0 || n.sources.posts > 0 || n.sources.tipPosts > 0) && ' \\ '}{numWithUnits(n.sources.tipComments, { abbreviate: false })} for zapping top comments early</span>}
          </div>}
        <div style={{ lineHeight: '140%' }}>
          SN distributes the sats it earns to top stackers like you daily. The top stackers make the top posts and comments or zap the top posts and comments early and generously. View the rewards pool and make a donation <Link href='/rewards'>here</Link>.
        </div>
        <small className='text-muted ms-1 pb-1 fw-normal'>click for details</small>
      </div>
    </div>
  )
}

function ReferralReward ({ n }) {
  return (
    <div className='d-flex'>
      <UserAdd className='align-self-center fill-success mx-1' width={24} height={24} style={{ flex: '0 0 24px', transform: 'rotateY(180deg)' }} />
      <div className='ms-2'>
        <NoteHeader color='success' big>
          you stacked {numWithUnits(n.earnedSats, { abbreviate: false })} in referral rewards<small className='text-muted ms-1 fw-normal' suppressHydrationWarning>{dayMonthYear(new Date(n.sortTime))}</small>
        </NoteHeader>
        {n.sources &&
          <div style={{ fontSize: '80%', color: 'var(--theme-grey)' }}>
            {n.sources.forever > 0 && <span>{numWithUnits(n.sources.forever, { abbreviate: false })} for stackers joining because of you</span>}
            {n.sources.oneDay > 0 && <span>{n.sources.forever > 0 && ' \\ '}{numWithUnits(n.sources.oneDay, { abbreviate: false })} for stackers referred to content by you today</span>}
          </div>}
        <div style={{ lineHeight: '140%' }}>
          SN gives referral rewards to stackers like you for referring the top stackers daily. You refer stackers when they visit your posts, comments, profile, territory, or if they visit SN through your referral links.
        </div>
        <small className='text-muted ms-1 pb-1 fw-normal'>click for details</small>
      </div>
    </div>
  )
}

function RevenueNotification ({ n }) {
  return (
    <div className='d-flex'>
      <BountyIcon className='align-self-center fill-success mx-1' width={24} height={24} style={{ flex: '0 0 24px' }} />
      <div className='ms-2'>
        <NoteHeader color='success' big>
          you stacked {numWithUnits(n.earnedSats, { abbreviate: false })} in territory revenue<small className='text-muted ms-1 fw-normal' suppressHydrationWarning>{timeSince(new Date(n.sortTime))}</small>
        </NoteHeader>
        <div style={{ lineHeight: '140%' }}>
          As the founder of territory <Link href={`/~${n.subName}`}>~{n.subName}</Link>, you receive 70% of the post, comment, boost, and zap fees. The other 30% go to <Link href='/rewards'>rewards</Link>.
        </div>
      </div>
    </div>
  )
}

function SubStatus ({ n }) {
  const dueDate = nextBillingWithGrace(n.sub)
  return (
    <div className={`fw-bold text-${n.sub.status === 'ACTIVE' ? 'success' : 'danger'} `}>
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
      <NoteHeader color='secondary'>
        your invite has been redeemed by
        {' ' + numWithUnits(n.invite.invitees.length, {
          abbreviate: false,
          unitSingular: 'stacker',
          unitPlural: 'stackers'
        })}
      </NoteHeader>
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
    <div className='fw-bold text-nostr'>
      <NostrIcon width={24} height={24} className='fill-nostr me-1' />{numWithUnits(n.earnedSats)} zap from
      {// eslint-disable-next-line
        <Link className='mx-1 text-reset text-underline' target='_blank' href={`https://njump.me/${npub}`} rel={UNKNOWN_LINK_REL}>
          {npub.slice(0, 10)}...
        </Link>
        }
      on {note
          ? (
            // eslint-disable-next-line
            <Link className='mx-1 text-reset text-underline' target='_blank' href={`https://njump.me/${note}`} rel={UNKNOWN_LINK_REL}>
              {note.slice(0, 12)}...
            </Link>)
          : 'nostr'}
      <small className='text-muted ms-1 fw-normal' suppressHydrationWarning>{timeSince(new Date(n.sortTime))}</small>
      {content && <small className='d-block ms-4 ps-1 mt-1 mb-1 text-muted fw-normal'><Text>{content}</Text></small>}
    </div>
  )
}

function getPayerSig (lud18Data) {
  let payerSig
  if (lud18Data) {
    const { name, identifier, email, pubkey } = lud18Data
    const id = identifier || email || pubkey
    payerSig = '- '
    if (name) {
      payerSig += name
      if (id) payerSig += ' \\ '
    }

    if (id) payerSig += id
  }
  return payerSig
}

function InvoicePaid ({ n }) {
  const payerSig = getPayerSig(n.invoice.lud18Data)
  let actionString = 'deposited to your account'
  let sats = n.earnedSats
  if (n.invoice.forwardedSats) {
    actionString = 'sent directly to your attached wallet'
    sats = n.invoice.forwardedSats
  }

  return (
    <div className='fw-bold text-info'>
      <Check className='fill-info me-1' />{numWithUnits(sats, { abbreviate: false, unitSingular: 'sat was', unitPlural: 'sats were' })} {actionString}
      <small className='text-muted ms-1 fw-normal' suppressHydrationWarning>{timeSince(new Date(n.sortTime))}</small>
      {n.invoice.forwardedSats && <Badge className={styles.badge} bg={null}>p2p</Badge>}
      {n.invoice.comment &&
        <small className='d-block ms-4 ps-1 mt-1 mb-1 text-muted fw-normal'>
          <Text>{n.invoice.comment}</Text>
          {payerSig}
        </small>}
    </div>
  )
}

function useActRetry ({ invoice }) {
  const bountyCacheMods =
    invoice.item.root?.bounty === invoice.satsRequested && invoice.item.root?.mine
      ? payBountyCacheMods
      : {}

  const update = (cache, { data }) => {
    const response = Object.values(data)[0]
    if (!response?.invoice) return
    cache.modify({
      id: `ItemAct:${invoice.itemAct?.id}`,
      fields: {
        // this is a bit of a hack just to update the reference to the new invoice
        invoice: () => cache.writeFragment({
          id: `Invoice:${response.invoice.id}`,
          fragment: gql`
            fragment _ on Invoice {
              bolt11
            }
          `,
          data: { bolt11: response.invoice.bolt11 }
        })
      }
    })
    paidActionCacheMods?.update?.(cache, { data })
    bountyCacheMods?.update?.(cache, { data })
  }

  return useAct({
    query: RETRY_PAID_ACTION,
    onPayError: (e, cache, { data }) => {
      paidActionCacheMods?.onPayError?.(e, cache, { data })
      bountyCacheMods?.onPayError?.(e, cache, { data })
    },
    onPaid: (cache, { data }) => {
      paidActionCacheMods?.onPaid?.(cache, { data })
      bountyCacheMods?.onPaid?.(cache, { data })
    },
    update,
    updateOnFallback: update
  })
}

function Invoicification ({ n: { invoice, sortTime } }) {
  const toaster = useToast()
  const actRetry = useActRetry({ invoice })
  const retryCreateItem = useRetryCreateItem({ id: invoice.item?.id })
  const retryPollVote = usePollVote({ query: RETRY_PAID_ACTION, itemId: invoice.item?.id })
  const [disableRetry, setDisableRetry] = useState(false)
  // XXX if we navigate to an invoice after it is retried in notifications
  // the cache will clear invoice.item and will error on window.back
  // alternatively, we could/should
  // 1. update the notification cache to include the new invoice
  // 2. make item has-many invoices
  if (!invoice.item) return null

  let retry
  let actionString
  let invoiceId
  let invoiceActionState
  const itemType = invoice.item.title ? 'post' : 'comment'

  if (invoice.actionType === 'ITEM_CREATE') {
    actionString = `${itemType} create `
    retry = retryCreateItem;
    ({ id: invoiceId, actionState: invoiceActionState } = invoice.item.invoice)
  } else if (invoice.actionType === 'POLL_VOTE') {
    actionString = 'poll vote '
    retry = retryPollVote
    invoiceId = invoice.item.poll?.meInvoiceId
    invoiceActionState = invoice.item.poll?.meInvoiceActionState
  } else {
    if (invoice.actionType === 'ZAP') {
      if (invoice.item.root?.bounty === invoice.satsRequested && invoice.item.root?.mine) {
        actionString = 'bounty payment'
      } else {
        actionString = 'zap'
      }
    } else if (invoice.actionType === 'DOWN_ZAP') {
      actionString = 'downzap'
    } else if (invoice.actionType === 'BOOST') {
      actionString = 'boost'
    }
    actionString = `${actionString} on ${itemType} `
    retry = actRetry;
    ({ id: invoiceId, actionState: invoiceActionState } = invoice.itemAct.invoice)
  }

  let colorClass = 'info'
  switch (invoiceActionState) {
    case 'FAILED':
      actionString += 'failed'
      colorClass = 'warning'
      break
    case 'PAID':
      actionString += 'paid'
      colorClass = 'success'
      break
    default:
      actionString += 'pending'
  }

  return (
    <div>
      <NoteHeader color={colorClass}>
        {actionString}
        <span className='ms-1 text-muted fw-light'> {numWithUnits(invoice.satsRequested)}</span>
        <span className={invoiceActionState === 'FAILED' ? 'visible' : 'invisible'}>
          <Button
            size='sm' variant={classNames('outline-warning ms-2 border-1 rounded py-0', disableRetry && 'pulse')}
            style={{ '--bs-btn-hover-color': '#fff', '--bs-btn-active-color': '#fff' }}
            disabled={disableRetry}
            onClick={async () => {
              if (disableRetry) return
              setDisableRetry(true)
              try {
                const { error } = await retry({ variables: { invoiceId: parseInt(invoiceId) } })
                if (error) throw error
              } catch (error) {
                toaster.danger(error?.message || error?.toString?.())
              } finally {
                setDisableRetry(false)
              }
            }}
          >
            retry
          </Button>
          <span className='text-muted ms-2 fw-normal' suppressHydrationWarning>{timeSince(new Date(sortTime))}</span>
        </span>
      </NoteHeader>
      <NoteItem item={invoice.item} setDisableRetry={setDisableRetry} disableRetry={disableRetry} />
    </div>
  )
}

function WithdrawlPaid ({ n }) {
  let amount = n.earnedSats + n.withdrawl.satsFeePaid
  let actionString = 'withdrawn from your account'

  if (n.withdrawl.autoWithdraw) {
    actionString = 'sent to your attached wallet'
  }

  if (n.withdrawl.forwardedActionType === 'ZAP') {
    // don't expose receivers to routing fees they aren't paying
    amount = n.earnedSats
    actionString = 'zapped directly to your attached wallet'
  }

  return (
    <div className='fw-bold text-info'>
      <Check className='fill-info me-1' />
      {numWithUnits(amount, { abbreviate: false, unitSingular: 'sat was ', unitPlural: 'sats were ' })}
      {actionString}
      <small className='text-muted ms-1 fw-normal' suppressHydrationWarning>{timeSince(new Date(n.sortTime))}</small>
      {(n.withdrawl.forwardedActionType === 'ZAP' && <Badge className={styles.badge} bg={null}>p2p</Badge>) ||
        (n.withdrawl.autoWithdraw && <Badge className={styles.badge} bg={null}>autowithdraw</Badge>)}
    </div>
  )
}

function Referral ({ n }) {
  const { me } = useMe()
  let referralSource = 'of you'
  switch (n.source?.__typename) {
    case 'Item':
      referralSource = (Number(me?.id) === Number(n.source.user?.id) ? 'of your' : 'you shared this') + ' ' + (n.source.title ? 'post' : 'comment')
      break
    case 'Sub':
      referralSource = (Number(me?.id) === Number(n.source.userId) ? 'of your' : 'you shared the') + ' ~' + n.source.name + ' territory'
      break
    case 'User':
      referralSource = (me?.name === n.source.name ? 'of your profile' : `you shared ${n.source.name}'s profile`)
      break
  }
  return (
    <>
      <small className='fw-bold text-success'>
        <UserAdd className='fill-success me-1' height={21} width={21} style={{ transform: 'rotateY(180deg)' }} />someone joined SN because {referralSource}
        <small className='text-muted ms-1 fw-normal' suppressHydrationWarning>{timeSince(new Date(n.sortTime))}</small>
      </small>
      {n.source?.__typename === 'Item' && <NoteItem itemClassName='pt-2' item={n.source} />}
    </>
  )
}

function stackedText (item) {
  let text = ''
  if (item.sats - item.credits > 0) {
    text += `${numWithUnits(item.sats - item.credits, { abbreviate: false })}`

    if (item.credits > 0) {
      text += ' and '
    }
  }
  if (item.credits > 0) {
    text += `${numWithUnits(item.credits, { abbreviate: false, unitSingular: 'CC', unitPlural: 'CCs' })}`
  }

  return text
}

function Votification ({ n }) {
  let forwardedSats = 0
  let ForwardedUsers = null
  let stackedTextString
  let forwardedTextString
  if (n.item.forwards?.length) {
    forwardedSats = Math.floor(n.earnedSats * n.item.forwards.map(fwd => fwd.pct).reduce((sum, cur) => sum + cur) / 100)
    ForwardedUsers = () => n.item.forwards.map((fwd, i) =>
      <span key={fwd.user.name}>
        <Link className='text-success' href={`/${fwd.user.name}`}>
          @{fwd.user.name}
        </Link>
        {i !== n.item.forwards.length - 1 && ' '}
      </span>)
    stackedTextString = numWithUnits(n.earnedSats, { abbreviate: false, unitSingular: 'CC', unitPlural: 'CCs' })
    forwardedTextString = numWithUnits(forwardedSats, { abbreviate: false, unitSingular: 'CC', unitPlural: 'CCs' })
  } else {
    stackedTextString = stackedText(n.item)
  }
  return (
    <>
      <NoteHeader color='success'>
        <span className='d-inline-flex'>
          <span>
            your {n.item.title ? 'post' : 'reply'} stacked {stackedTextString}
            {n.item.forwards?.length > 0 &&
              <>
                {' '}and forwarded {forwardedTextString} to{' '}
                <ForwardedUsers />
              </>}
          </span>
          {n.item.credits > 0 && <CCInfo size={16} />}
        </span>
      </NoteHeader>
      <NoteItem item={n.item} />
    </>
  )
}

function ForwardedVotification ({ n }) {
  return (
    <>
      <NoteHeader color='success'>
        <span className='d-inline-flex'>
          you were forwarded {numWithUnits(n.earnedSats, { abbreviate: false, unitSingular: 'CC', unitPlural: 'CCs' })}
          <CCInfo size={16} />
        </span>
      </NoteHeader>
      <NoteItem item={n.item} />
    </>
  )
}

function Mention ({ n }) {
  return (
    <>
      <NoteHeader color='info'>
        you were mentioned in
      </NoteHeader>
      <NoteItem item={n.item} />
    </>
  )
}

function ItemMention ({ n }) {
  return (
    <>
      <NoteHeader color='info'>
        your item was mentioned in
      </NoteHeader>
      <NoteItem item={n.item} />
    </>
  )
}

function JobChanged ({ n }) {
  return (
    <>
      <NoteHeader color={n.item.status === 'ACTIVE' ? 'success' : 'boost'}>
        {n.item.status === 'ACTIVE'
          ? 'your job is active again'
          : (n.item.status === 'NOSATS'
              ? 'your job promotion ran out of sats'
              : 'your job has been stopped')}
      </NoteHeader>
      <ItemJob item={n.item} />
    </>
  )
}

function Reply ({ n }) {
  return <NoteItem item={n.item} />
}

function FollowActivity ({ n }) {
  return (
    <>
      <NoteHeader color='info'>
        a stacker you subscribe to {n.item.parentId ? 'commented' : 'posted'}
      </NoteHeader>
      <NoteItem item={n.item} />
    </>
  )
}

function TerritoryPost ({ n }) {
  return (
    <>
      <NoteHeader color='info'>
        new post in ~{n.item.sub.name}
      </NoteHeader>
      <div>
        <Item item={n.item} itemClassName='pt-0' />
      </div>
    </>
  )
}

function TerritoryTransfer ({ n }) {
  return (
    <div className='fw-bold text-info '>
      ~{n.sub.name} was transferred to you
      <small className='text-muted ms-1 fw-normal' suppressHydrationWarning>{timeSince(new Date(n.sortTime))}</small>
    </div>
  )
}

function Reminder ({ n }) {
  return (
    <>
      <NoteHeader color='info'>
        you asked to be reminded of this {n.item.title ? 'post' : 'comment'}
      </NoteHeader>
      <NoteItem item={n.item} />
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

  const { notifications, lastChecked, cursor } = useMemo(() => {
    if (!dat?.notifications) return {}

    // make sure we're using the oldest lastChecked we've seen
    const retDat = { ...dat.notifications }
    if (ssrData?.notifications?.lastChecked < retDat.lastChecked) {
      retDat.lastChecked = ssrData.notifications.lastChecked
    }
    return retDat
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
  }, [router?.query?.checkedAt, lastChecked])

  if (!dat) return <CommentsFlatSkeleton />

  return (
    <>
      {notifications.map(n =>
        <Notification
          n={n} key={nid(n)}
          fresh={new Date(n.sortTime) > new Date(router?.query?.checkedAt ?? lastChecked)}
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
