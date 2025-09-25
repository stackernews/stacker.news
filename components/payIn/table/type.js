import { timeSince } from '@/lib/time'
import { describePayInType } from '@/lib/pay-in'
import { PayInStatus } from '../status'

export function PayInType ({ payIn }) {
  return (
    <>
      <small className='text-muted' title={payIn.payInStateChangedAt} suppressHydrationWarning>{timeSince(new Date(payIn.payInStateChangedAt))}</small>
      <small style={{ maxWidth: '120px' }}><PayInTypeShortDescription payIn={payIn} /></small>
      <PayInStatus payIn={payIn} />
    </>
  )
}

function PayInTypeShortDescription ({ payIn }) {
  return <small className='text-muted'>{describePayInType(payIn)}</small>
}
