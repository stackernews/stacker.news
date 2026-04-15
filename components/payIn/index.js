import { msatsToSats, numWithUnits } from '@/lib/format'
import { NORMAL_POLL_INTERVAL_MS } from '@/lib/constants'
import { FAILED_PAY_IN_STATES, getPayInFailurePresentation, describePayInType } from '@/lib/pay-in'
import Qr from '../qr'
import Bolt11Info from './bolt11-info'
import useWatchPayIn from './hooks/use-watch-pay-in'
import { PayInStatus, PayInStatusSkeleton } from './status'
import PayInMetadata from './metadata'
import { PayInContext } from './context'
import { GET_PAY_IN_FULL_WITHOUT_WALLET_INFO } from '@/fragments/payIn'
import { PayInSankey, PayInSankeySkeleton } from './sankey'
import { useMe } from '@/components/me'
import { WalletLogs } from '@/wallets/client/components'
import Link from 'next/link'
import AccordianItem from '../accordian-item'

const TERMINAL_PAY_IN_STATES = new Set(['PAID', 'FAILED'])

export default function PayIn ({ id, ssrData }) {
  const { me } = useMe()
  const { data, error } = useWatchPayIn({ id, query: GET_PAY_IN_FULL_WITHOUT_WALLET_INFO })

  // Keep the SSR walletInfo instead of re-resolving it on every poll.
  const payIn = data?.payIn
    ? {
        ...data.payIn,
        walletInfo: data.payIn.walletInfo ?? ssrData?.payIn?.walletInfo
      }
    : ssrData?.payIn

  if (error) {
    return <div>{error.message}</div>
  }

  if (!payIn) {
    return <PayInSkeleton />
  }

  return (
    <div className='py-5'>
      <div className='d-flex justify-content-between align-items-center'>
        <div className='d-flex gap-3'>
          <h2>{describePayInType(payIn, me)}</h2>
          <PayInStatus payIn={payIn} />
        </div>
        <div>
          <small className='text-muted' suppressHydrationWarning>{new Date(payIn.createdAt).toLocaleString()}</small>
        </div>
      </div>
      <PayInFailureMessage payIn={payIn} />
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
                <div className='mt-3'>
                  <AccordianItem
                    header='lightning invoice'
                    body={(
                      <Bolt11Info
                        bolt11={payIn.payerPrivates.payInBolt11.bolt11}
                        hash={payIn.payerPrivates.payInBolt11.hash}
                        preimage={payIn.payerPrivates.payInBolt11.preimage}
                        description={payIn.payerPrivates.payInBolt11.description}
                      />
                    )}
                  />
                </div>
                )}
            <PayInMetadata payInBolt11={payIn.payerPrivates.payInBolt11} />
          </>
        )}
      <div className='mt-3'>
        <PayInContext payIn={payIn} />
      </div>
      {payIn.mcost > 0 &&
        <div className='mt-5 d-flex flex-column'>
          <h5 className='mb-3'>diagram</h5>
          <div className='d-flex justify-content-center' style={{ marginRight: '-15px', marginLeft: '-15px' }}>
            <PayInSankey payIn={payIn} />
          </div>
        </div>}
      <PayInWalletSection payIn={payIn} />
    </div>
  )
}

function PayInFailureMessage ({ payIn }) {
  if (!FAILED_PAY_IN_STATES.includes(payIn.payInState)) {
    return null
  }

  const failure = getPayInFailurePresentation(payIn)
  if (!failure) {
    return null
  }

  const showDetail = payIn.payerPrivates?.payInFailureReason === 'EXECUTION_FAILED' && failure.detail

  return (
    <div className='mt-1 text-muted'>
      <small className='d-block'>{failure.summary}</small>
      {showDetail && <small className='d-block'>{failure.detail}</small>}
    </div>
  )
}

function PayInWalletSection ({ payIn }) {
  const walletInfo = payIn.walletInfo
  if (!walletInfo) {
    return null
  }

  const roleLabels = {
    SEND: 'send wallet',
    RECEIVE: 'receive wallet'
  }
  const shouldPoll = !TERMINAL_PAY_IN_STATES.has(payIn.payInState)

  return (
    <div className='mt-3'>
      <div className='mb-3 text-break'>
        <span className='text-muted'>{roleLabels[walletInfo.role] ?? walletInfo.role.toLowerCase()}:</span>{' '}
        <Link href={`/wallets/${walletInfo.walletId}`}>{walletInfo.walletName}</Link>{' '}
        <span className='text-muted'>via {walletInfo.protocolName}</span>
      </div>
      <WalletLogs payInId={Number(payIn.id)} poll={shouldPoll} pollInterval={NORMAL_POLL_INTERVAL_MS} />
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
      <div className='mt-3'>
        <div className='w-100 p-5 h-25' />
      </div>
      <div className='mt-5 d-flex flex-column'>
        <h5 className='mb-3'>diagram</h5>
        <div className='d-flex justify-content-center'>
          <PayInSankeySkeleton />
        </div>
      </div>
      <div className='mt-3'>
        <div className='clouds rounded-2 mb-3' style={{ height: '1.5rem', maxWidth: '24rem' }} />
        <div className='clouds rounded-3 w-100' style={{ height: '10rem' }} />
      </div>
    </div>
  )
}
