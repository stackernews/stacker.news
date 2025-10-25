import CompactLongCountdown from '@/components/countdown'
import Moon from '@/svgs/moon-fill.svg'
import Check from '@/svgs/check-double-line.svg'
import ThumbDown from '@/svgs/thumb-down-fill.svg'

const statusIconSize = 16

function StatusText ({ color, children }) {
  return (
    <small className={`ms-1 text-${color}`} style={{ fontWeight: '600' }}>{children}</small>
  )
}

export function PayInStatus ({ payIn }) {
  return (
    <div className='d-flex align-items-center'>
      {(payIn.payInState === 'PAID' && <><Check width={statusIconSize} height={statusIconSize} className='fill-success' /><StatusText color='success'>{payIn.mcost > 0 ? 'paid' : 'free'}</StatusText></>) ||
        ((payIn.payInState === 'FAILED' || payIn.payInState === 'CANCELLED' || payIn.payInState === 'FORWARD_FAILED') && <><ThumbDown width={statusIconSize} height={statusIconSize} className='fill-danger' /><StatusText color='danger'>failed</StatusText></>) ||
        ((payIn.payInState === 'FORWARDING' || payIn.payInState === 'FORWARDED' || !payIn.payerPrivates.payInBolt11) && <><Moon width={statusIconSize} height={statusIconSize} className='spin fill-grey' /><StatusText color='muted'>settling</StatusText></>) ||
        (<CompactLongCountdown date={payIn.payerPrivates.payInBolt11.expiresAt} />)}
    </div>
  )
}

export function PayInStatusSkeleton () {
  return (
    <div className='d-flex align-items-center'>
      <div className='clouds' style={{ width: statusIconSize, height: statusIconSize }} />
      <StatusText color='muted'>loading</StatusText>
    </div>
  )
}
