import { msatsToSats, numWithUnits } from '@/lib/format'
import Qr, { QrSkeleton } from '../qr'
import Bolt11Info from './bolt11-info'
import useWatchPayIn from './hooks/use-watch-pay-in'
import PayInError from './error'
import PayInStatus from './status'
import PayInResult from './result'
import PayInMetadata from './metadata'

export default function PayIn ({
  id, onPaymentError, onPaymentSuccess, waitFor, walletError, detailed
}) {
  console.log('PayIn component', id)
  const { data, error } = useWatchPayIn({ id, onPaymentError, onPaymentSuccess, waitFor })

  const payIn = data?.payIn

  if (error) {
    return <div>{error.message}</div>
  }

  if (!payIn) {
    return <QrSkeleton description />
  }

  const { bolt11, confirmedPreimage } = payIn.payInBolt11

  return (
    <>
      <PayInError error={walletError} />
      <Qr
        value={bolt11}
        qrTransform={value => 'lightning:' + value.toUpperCase()}
        description={numWithUnits(msatsToSats(payIn.payInBolt11.msatsRequested), { abbreviate: false })}
      />
      <PayInStatus payIn={payIn} />
      {detailed &&
        <>
          <PayInMetadata {...payIn} />
          <Bolt11Info bolt11={bolt11} preimage={confirmedPreimage} />
          {payIn?.payInItem && <PayInResult payIn={payIn} />}
        </>}
    </>
  )
}
