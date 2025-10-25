import { timeSince } from '@/lib/time'
import { describePayInType } from '@/lib/pay-in'
import { PayInStatus } from '../status'
import { useMe } from '@/components/me'

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
  const { me } = useMe()
  return <small className='text-muted'>{describePayInType(payIn, me)}</small>
}
