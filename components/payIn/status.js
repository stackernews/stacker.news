import CompactLongCountdown from '@/components/countdown'
import { msatsToSats, numWithUnits } from '@/lib/format'
import Moon from '@/svgs/moon-fill.svg'
import Check from '@/svgs/check-double-line.svg'
import ThumbDown from '@/svgs/thumb-down-fill.svg'

export default function PayInStatus ({ payIn }) {
  let variant = 'pending'
  let status = 'waiting for you'

  if (payIn.payInState === 'PAID') {
    variant = 'paid'
    status = `${numWithUnits(msatsToSats(payIn.payInBolt11.msatsReceived), { abbreviate: false })} paid`
  } else if (payIn.payInState === 'FAILED') {
    variant = 'failed'
    if (payIn.payInFailureReason === 'INVOICE_EXPIRED') {
      status = 'expired'
    } else if (payIn.payInFailureReason === 'INVOICE_CANCELLED') {
      status = 'cancelled'
    } else {
      status = 'failed'
    }
  } else if (payIn.payInState === 'PENDING_HELD' || payIn.payInState === 'PENDING') {
    variant = 'settling'
    status = <CompactLongCountdown date={payIn.payInBolt11.expiresAt} />
  } else {
    variant = 'pending'
    status = 'settling'
  }

  return (
    <div className='d-flex mt-1 justify-content-center align-items-center'>
      {variant === 'paid' && <Check className='fill-success' />}
      {variant === 'failed' && <ThumbDown className='fill-danger' />}
      {variant === 'pending' && <Moon className='spin fill-grey' />}
      <div
        className={`ms-3 text-${variant === 'paid' ? 'success' : variant === 'failed' ? 'danger' : 'muted'}`}
        style={{ fontWeight: '600' }}
      >{status}
      </div>
    </div>
  )
}
