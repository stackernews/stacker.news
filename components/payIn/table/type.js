import { msatsToSats } from '@/lib/format'
import Moon from '@/svgs/moon-fill.svg'
import Check from '@/svgs/check-double-line.svg'
import ThumbDown from '@/svgs/thumb-down-fill.svg'
import { timeSince } from '@/lib/time'
import { useMe } from '@/components/me'

export function PayInType ({ payIn }) {
  return (
    <>
      <small className='text-muted' title={payIn.payInStateChangedAt} suppressHydrationWarning>{timeSince(new Date(payIn.payInStateChangedAt))}</small>
      <small><PayInTypeShortDescription payIn={payIn} /></small>
      <PayInStatus payIn={payIn} />
    </>
  )
}

function PayInTypeShortDescription ({ payIn }) {
  const { me } = useMe()
  return <small className='text-muted'>{describePayInType(payIn)}{Number(payIn.userId) !== Number(me.id) ? ' receive' : ''}</small>
}

function describePayInType (payIn) {
  switch (payIn.payInType) {
    case 'ITEM_CREATE':
      if (payIn.item.isJob) {
        return 'job'
      } else if (payIn.item.title) {
        return 'post'
      } else if (payIn.item.parentId) {
        return 'comment'
      } else {
        return 'item'
      }
    case 'ITEM_UPDATE':
      if (payIn.item.isJob) {
        return 'job edit'
      } else if (payIn.item.title) {
        return 'post edit'
      } else if (payIn.item.parentId) {
        return 'comment edit'
      } else {
        return 'item edit'
      }
    case 'ZAP':
      if (payIn.item?.root?.bounty === msatsToSats(payIn.mcost)) {
        return 'pay bounty'
      } else {
        return 'zap'
      }
    case 'DOWN_ZAP':
      return 'downzap'
    case 'BOOST':
      return 'boost'
    case 'POLL_VOTE':
      return 'poll vote'
    case 'TERRITORY_CREATE':
      return 'territory created'
    case 'TERRITORY_UPDATE':
      return 'territory updated'
    case 'TERRITORY_BILLING':
      return 'territory billing'
    case 'TERRITORY_UNARCHIVE':
      return 'territory unarchived'
    case 'INVITE_GIFT':
      return 'invite gift'
    case 'DONATE':
      return 'donate'
    case 'BUY_CREDITS':
      return 'buy credits'
    case 'PROXY_PAYMENT':
      return 'proxy payment'
    case 'WITHDRAWAL':
      return 'withdrawal'
    case 'AUTOWITHDRAWAL':
      return 'autowithdrawal'
    default:
      return 'unknown'
  }
}

const statusIconSize = 16

export function PayInStatus ({ payIn }) {
  function StatusText ({ color, children }) {
    return (
      <small className={`ms-1 text-${color}`} style={{ fontWeight: '600' }}>{children}</small>
    )
  }

  return (
    <div className='d-flex align-items-center'>
      {(payIn.payInState === 'PAID' && <><Check width={statusIconSize} height={statusIconSize} className='fill-success' /><StatusText color='success'>paid</StatusText></>) ||
        ((payIn.payInState === 'FAILED' || payIn.payInState === 'CANCELLED' || payIn.payInState === 'FORWARD_FAILED') && <><ThumbDown width={statusIconSize} height={statusIconSize} className='fill-danger' /><StatusText color='danger'>failed</StatusText></>) ||
        ((payIn.payInState === 'FORWARDING' || payIn.payInState === 'FORWARDED') && <><Moon width={statusIconSize} height={statusIconSize} className='spin fill-grey' /><StatusText color='muted'>settling</StatusText></>) ||
        (<><Moon width={statusIconSize} height={statusIconSize} className='spin fill-grey' /><StatusText color='muted'>pending</StatusText></>)}
    </div>
  )
}
