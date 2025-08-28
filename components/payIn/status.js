import CompactLongCountdown from '@/components/countdown'
import Moon from '@/svgs/moon-fill.svg'
import Check from '@/svgs/check-double-line.svg'
import ThumbDown from '@/svgs/thumb-down-fill.svg'

const statusIconSize = 16

export function PayInStatus ({ payIn }) {
  function StatusText ({ color, children }) {
    return (
      <small className={`ms-1 text-${color}`} style={{ fontWeight: '600' }}>{children}</small>
    )
  }

  return (
    <div className='d-flex align-items-center'>
      {(payIn.payInState === 'PAID' && <><Check width={statusIconSize} height={statusIconSize} className='fill-success' /><StatusText color='success'>{payIn.mcost > 0 ? 'paid' : 'free'}</StatusText></>) ||
        ((payIn.payInState === 'FAILED' || payIn.payInState === 'CANCELLED' || payIn.payInState === 'FORWARD_FAILED') && <><ThumbDown width={statusIconSize} height={statusIconSize} className='fill-danger' /><StatusText color='danger'>failed</StatusText></>) ||
        ((payIn.payInState === 'FORWARDING' || payIn.payInState === 'FORWARDED' || !payIn.payInBolt11) && <><Moon width={statusIconSize} height={statusIconSize} className='spin fill-grey' /><StatusText color='muted'>settling</StatusText></>) ||
        (<CompactLongCountdown date={payIn.payInBolt11.expiresAt} />)}
    </div>
  )
}
