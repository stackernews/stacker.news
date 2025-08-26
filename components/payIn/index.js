import { msatsToSats, numWithUnits } from '@/lib/format'
import Qr, { QrSkeleton } from '../qr'
import Bolt11Info from './bolt11-info'
import useWatchPayIn from './hooks/use-watch-pay-in'
import { PayInStatus } from './status'
import PayInMetadata from './metadata'
import { describePayInType } from '@/lib/pay-in'
import { useMe } from '../me'
import { PayInContext } from './context'
import { GET_PAY_IN_FULL } from '@/fragments/payIn'

export default function PayIn ({ id }) {
  const { me } = useMe()
  const { data, error } = useWatchPayIn({ id, query: GET_PAY_IN_FULL })

  const payIn = data?.payIn

  if (error) {
    return <div>{error.message}</div>
  }

  if (!payIn) {
    return <QrSkeleton description />
  }

  return (
    <div>
      <div>{new Date(payIn.createdAt).toLocaleString()}</div>
      <div>{numWithUnits(msatsToSats(payIn.mcost), { abbreviate: false })}</div>
      <PayInStatus payIn={payIn} />
      <small className='text-muted'>{describePayInType(payIn, me.id)}</small>
      {payIn.payInBolt11 &&
        (
          <div>
            <Qr
              value={payIn.payInBolt11.bolt11}
              qrTransform={value => 'lightning:' + value.toUpperCase()}
              description={numWithUnits(msatsToSats(payIn.payInBolt11.msatsRequested), { abbreviate: false })}
            />
            <PayInMetadata payInBolt11={payIn.payInBolt11} />
            <Bolt11Info bolt11={payIn.payInBolt11.bolt11} preimage={payIn.payInBolt11.preimage} />
          </div>
        )}
      <PayInContext payIn={payIn} />
    </div>
  )
}
