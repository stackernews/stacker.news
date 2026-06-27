import { formatMsatsToSats, msatsToSats, numWithUnits } from '@/lib/format'
import { bolt11QrTransform } from '@/lib/bolt11'
import { NORMAL_POLL_INTERVAL_MS } from '@/lib/constants'
import { FAILED_PAY_IN_STATES, getPayInFailurePresentation, describePayInType } from '@/lib/pay-in'
import Qr from '../qr'
import Bolt11Info, { toBolt11InfoProps } from './bolt11-info'
import useWatchPayIn from './hooks/use-watch-pay-in'
import { PayInStatus, PayInStatusSkeleton } from './status'
import { PayInContext } from './context'
import { GET_PAY_IN_FULL_WITHOUT_WALLET_INFO } from '@/fragments/payIn'
import { PayInSankey, PayInSankeySkeleton } from './sankey'
import { useMe } from '@/components/me'
import {
  TransactionDetailHeading,
  TransactionDetailPage,
  TransactionDetailSection,
  TransactionHeadingTitle,
  WalletErrorShell,
  WalletLogs,
  transactionDetailStyles
} from '@/wallets/client/components'

const TERMINAL_PAY_IN_STATES = new Set(['PAID', 'FAILED'])
const PAY_IN_INVOICE_CONTEXT_TYPES = new Set(['PROXY_PAYMENT', 'WITHDRAWAL', 'AUTO_WITHDRAWAL'])

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
    return <WalletErrorShell title='transaction unavailable' message={error.message} />
  }

  if (!payIn) {
    return <PayInSkeleton />
  }

  const payerBolt11 = payIn.payerPrivates?.payInBolt11
  const payerBolt11Pending = payerBolt11 && ['PENDING', 'PENDING_HELD'].includes(payIn.payInState)
  const invoiceDetails = payerBolt11 && !payInContextIsInvoiceDetails(payIn) ? payerBolt11 : null

  return (
    <TransactionDetailPage>
      <TransactionDetailHeading
        title={
          <TransactionHeadingTitle amount={formatMsatsToSats(payIn.mcost)}>
            {describePayInType(payIn, me)}
          </TransactionHeadingTitle>
        }
        walletInfo={payIn.walletInfo}
        identity={payIn.walletInfo ? undefined : null}
        status={<PayInStatus payIn={payIn} />}
        timestamp={payIn.payInStateChangedAt}
      />
      <PayInFailureMessage payIn={payIn} />

      <TransactionDetailSection>
        <div className='d-flex flex-column gap-3'>
          {payerBolt11Pending && (
            <div className={transactionDetailStyles.qrContext}>
              <Qr
                value={payerBolt11.bolt11}
                qrTransform={bolt11QrTransform}
                description={numWithUnits(msatsToSats(payerBolt11.msatsRequested), { abbreviate: false })}
              />
            </div>
          )}
          <PayInContext payIn={payIn} />
        </div>
      </TransactionDetailSection>

      {payIn.mcost > 0 && (
        <TransactionDetailSection title='diagram'>
          <div className='d-flex justify-content-center' style={{ marginRight: '-15px', marginLeft: '-15px' }}>
            <PayInSankey payIn={payIn} />
          </div>
        </TransactionDetailSection>
      )}

      {invoiceDetails && (
        <TransactionDetailSection title='invoice details'>
          <Bolt11Info
            showAmount={false}
            {...toBolt11InfoProps(invoiceDetails)}
          />
        </TransactionDetailSection>
      )}

      <PayInWalletSection payIn={payIn} />
    </TransactionDetailPage>
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
    <div className='text-muted'>
      <small className='d-block'>{failure.summary}</small>
      {showDetail && <small className='d-block'>{failure.detail}</small>}
    </div>
  )
}

function payInContextIsInvoiceDetails (payIn) {
  return PAY_IN_INVOICE_CONTEXT_TYPES.has(payIn.payInType)
}

function PayInWalletSection ({ payIn }) {
  const walletInfo = payIn.walletInfo
  if (!walletInfo) {
    return null
  }

  const shouldPoll = !TERMINAL_PAY_IN_STATES.has(payIn.payInState)

  return (
    <TransactionDetailSection title='logs'>
      <WalletLogs payInId={Number(payIn.id)} poll={shouldPoll} pollInterval={NORMAL_POLL_INTERVAL_MS} />
    </TransactionDetailSection>
  )
}

export function PayInSkeleton () {
  return (
    <TransactionDetailPage>
      <TransactionDetailHeading
        title={<span className='clouds px-5'>loading</span>}
        identity={null}
        status={<PayInStatusSkeleton />}
      />
      <TransactionDetailSection>
        <div className='w-100 p-5 h-25' />
      </TransactionDetailSection>
      <TransactionDetailSection title='diagram'>
        <div className='d-flex justify-content-center'>
          <PayInSankeySkeleton />
        </div>
      </TransactionDetailSection>
      <TransactionDetailSection title='logs'>
        <div className='clouds rounded-2 mb-3' style={{ height: '1.5rem', maxWidth: '24rem' }} />
        <div className='clouds rounded-3 w-100' style={{ height: '10rem' }} />
      </TransactionDetailSection>
    </TransactionDetailPage>
  )
}
