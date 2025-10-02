import { msatsToSats, numWithUnits } from '@/lib/format'
import Qr from '../qr'
import Bolt11Info from './bolt11-info'
import useWatchPayIn from './hooks/use-watch-pay-in'
import { PayInStatus, PayInStatusSkeleton } from './status'
import PayInMetadata from './metadata'
import { describePayInType } from '@/lib/pay-in'
import { PayInContext } from './context'
import { GET_PAY_IN_FULL } from '@/fragments/payIn'
import { PayInSankey, PayInSankeySkeleton } from './sankey'
import { useMe } from '@/components/me'

export default function PayIn ({ id, ssrData }) {
  const { me } = useMe()
  const { data, error } = useWatchPayIn({ id, query: GET_PAY_IN_FULL })

  const payIn = data?.payIn || ssrData?.payIn

  if (error) {
    return <div>{error.message}</div>
  }

  if (!payIn) {
    return <PayInSkeleton />
  }

  return (
    <div>
      <div className='d-flex justify-content-between align-items-center'>
        <div className='d-flex gap-3'>
          <h2>{describePayInType(payIn, me)}</h2>
          <PayInStatus payIn={payIn} />
        </div>
        <div>
          <small className='text-muted'>{new Date(payIn.createdAt).toLocaleString()}</small>
        </div>
      </div>
      {payIn.payerPrivates?.payInBolt11 &&
        (
          <>
            {['PENDING', 'PENDING_HELD'].includes(payIn.payInState)
              ? (
                <div className='d-flex justify-content-center'>
                  <div style={{ maxWidth: '300px' }}>
                    <Qr
                      value={payIn.payerPrivates.payInBolt11.bolt11}
                      qrTransform={value => 'lightning:' + value.toUpperCase()}
                      description={numWithUnits(msatsToSats(payIn.payerPrivates.payInBolt11.msatsRequested), { abbreviate: false })}
                    />
                  </div>
                </div>)
              : (
                <div className='mt-5'>
                  <h5 className='mb-3'>lightning invoice</h5>
                  <Bolt11Info bolt11={payIn.payerPrivates.payInBolt11.bolt11} preimage={payIn.payerPrivates.payInBolt11.preimage} />
                </div>
                )}
            <PayInMetadata payInBolt11={payIn.payerPrivates.payInBolt11} />
          </>
        )}
      <div className='mt-5'>
        <h5 className='mb-3'>context</h5>
        <PayInContext payIn={payIn} />
      </div>
      {payIn.mcost > 0 &&
        <div className='mt-5 d-flex flex-column'>
          <h5 className='mb-3'>transaction diagram</h5>
          <div className='d-flex justify-content-center'>
            <PayInSankey payIn={payIn} />
          </div>
        </div>}
    </div>
  )
}

export function PayInSkeleton () {
  return (
    <div>
      <div className='d-flex justify-content-between align-items-center'>
        <div className='d-flex gap-3'>
          <h2 className='clouds'>loading</h2>
          <PayInStatusSkeleton />
        </div>
        <div>
          <small className='text-muted clouds px-5' />
        </div>
      </div>
      <div className='mt-5'>
        <h5 className='mb-3'>context</h5>
        <div className='w-100 p-5 h-25' />
      </div>
      <div className='mt-5 d-flex flex-column'>
        <h5 className='mb-3'>transaction diagram</h5>
        <div className='d-flex justify-content-center'>
          <PayInSankeySkeleton />
        </div>
      </div>
    </div>
  )
}
