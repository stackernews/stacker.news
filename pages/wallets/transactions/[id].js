import { useQuery } from '@apollo/client/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Alert } from 'react-bootstrap'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { formatMsatsToSats } from '@/lib/format'
import { FAST_POLL_INTERVAL_MS, NORMAL_POLL_INTERVAL_MS } from '@/lib/constants'
import { bolt11QrTransform } from '@/lib/bolt11'
import { useData } from '@/components/use-data'
import PageLoading from '@/components/page-loading'
import Qr from '@/components/qr'
import { CompactLongCountdown } from '@/components/countdown'
import Bolt11Info, { toBolt11InfoProps } from '@/components/payIn/bolt11-info'
import { ExternalTransactionStatus } from '@/components/payIn/external-transaction-status'
import { GET_EXTERNAL_TRANSACTION } from '@/wallets/client/fragments'
import {
  TransactionDetailHeading,
  TransactionDetailPage,
  TransactionDetailSection,
  WalletErrorShell,
  WalletLogs
} from '@/wallets/client/components'
import { externalTransactionDiagnosticMessage } from '@/wallets/lib/external-transactions'

export const getServerSideProps = getGetServerSideProps({
  query: GET_EXTERNAL_TRANSACTION,
  variables: ({ id }) => ({ id: Number(id) }),
  authRequired: true
})

export default function ExternalTransactionPage ({ ssrData }) {
  const router = useRouter()
  const id = Number(router.query.id)
  const { data, error, startPolling, stopPolling } = useQuery(GET_EXTERNAL_TRANSACTION, {
    variables: { id },
    skip: !id
  })
  const dat = useData(data, ssrData)
  const transaction = dat?.externalTransaction
  // Derived expiry ends live page polling; the worker can still reconcile a late settlement.
  const done = dat ? (!transaction || transaction.status !== 'PENDING') : false
  const fastPoll = transaction?.status === 'PENDING' &&
    transaction.direction !== 'SEND'
  const [expiredTransactionId, setExpiredTransactionId] = useState()

  useEffect(() => {
    if (!id || done) {
      stopPolling()
      return
    }

    startPolling(fastPoll ? FAST_POLL_INTERVAL_MS : NORMAL_POLL_INTERVAL_MS)
    return () => stopPolling()
  }, [startPolling, stopPolling, id, done, fastPoll])

  if (!dat && error) {
    return <WalletErrorShell title='transaction unavailable' message={error.message} />
  }

  if (!dat) {
    return <PageLoading />
  }

  if (!transaction) {
    return <WalletErrorShell title='transaction not found' message='this wallet transaction could not be found' />
  }

  const { invoiceExpiresAt } = transaction
  const isSend = transaction.direction === 'SEND'
  const invoiceExpired = expiredTransactionId === transaction.id ||
    new Date(invoiceExpiresAt) <= new Date()
  const showReceiveQr = !isSend && transaction.bolt11 &&
    ['PENDING', 'UNKNOWN'].includes(transaction.status) && !invoiceExpired
  const diagnostic = externalTransactionDiagnosticMessage(transaction)

  return (
    <TransactionDetailPage>
      <TransactionDetailHeading
        title={isSend ? 'send' : 'receive'}
        amount={formatMsatsToSats(transaction.settledMsats ?? transaction.amountMsats)}
        walletInfo={transaction.walletInfo}
        identity={transaction.walletInfo ? undefined : 'external wallet'}
        status={<ExternalTransactionStatus transaction={transaction} className='justify-content-end' />}
        timestamp={transaction.statusChangedAt}
      />

      {showReceiveQr && (
        <TransactionDetailSection>
          <div className='w-100 mx-auto py-5' style={{ maxWidth: '560px' }}>
            <Qr
              value={transaction.bolt11}
              qrTransform={bolt11QrTransform}
              description={formatMsatsToSats(transaction.amountMsats)}
            />
            <div className='d-flex justify-content-center'>
              <CompactLongCountdown
                className='text-muted'
                date={invoiceExpiresAt}
                onComplete={() => setExpiredTransactionId(transaction.id)}
              />
            </div>
          </div>
        </TransactionDetailSection>
      )}

      {diagnostic && (
        <Alert variant='warning' className='mb-0'>
          <div className='fw-bold'>
            {transaction.status === 'UNKNOWN'
              ? (isSend ? 'status unknown' : 'settlement unconfirmed')
              : 'proof unavailable'}
          </div>
          <div>{diagnostic}</div>
        </Alert>
      )}

      {(transaction.bolt11 || transaction.hash) && (
        <TransactionDetailSection title='invoice details'>
          <Bolt11Info
            showAmount={false}
            {...toBolt11InfoProps(transaction)}
          >
            {transaction.sourceType === 'LN_ADDR' && transaction.sourceValue && (
              <div className='d-flex flex-column mt-2'>
                <small className='text-muted text-truncate' title={transaction.sourceValue}>to {transaction.sourceValue}</small>
              </div>
            )}
          </Bolt11Info>
        </TransactionDetailSection>
      )}

      <TransactionDetailSection title='logs'>
        <WalletLogs
          externalTransactionId={Number(transaction.id)}
          poll={!done}
          pollInterval={NORMAL_POLL_INTERVAL_MS}
        />
      </TransactionDetailSection>
    </TransactionDetailPage>
  )
}
