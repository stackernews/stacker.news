import { useQuery } from '@apollo/client/react'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { Alert } from 'react-bootstrap'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { formatMsatsToSats } from '@/lib/format'
import { NORMAL_POLL_INTERVAL_MS } from '@/lib/constants'
import { bolt11QrTransform } from '@/lib/bolt11'
import { useData } from '@/components/use-data'
import Qr from '@/components/qr'
import Bolt11Info, { toBolt11InfoProps } from '@/components/payIn/bolt11-info'
import { ExternalTransactionStatus } from '@/components/payIn/external-transaction-status'
import { GET_EXTERNAL_TRANSACTION } from '@/wallets/client/fragments'
import {
  TransactionDetailHeading,
  TransactionDetailPage,
  TransactionDetailSection,
  TransactionHeadingTitle,
  WalletErrorShell,
  WalletLogs,
  transactionDetailStyles
} from '@/wallets/client/components'
import { externalTransactionDiagnosticMessage, externalTransactionBolt11InfoProps, externalTransactionCheckStopped, TERMINAL_STATUSES } from '@/wallets/lib/external-transactions'

// a transaction stops changing once it's terminal, or once it's a "stopped" UNKNOWN (SN has given up
// checking — past the polling deadline or a permanent stop-reason) — no point polling its logs after.
function externalTransactionDone (transaction) {
  if (TERMINAL_STATUSES.has(transaction.settlementStatus)) return true
  return transaction.settlementStatus === 'UNKNOWN' && externalTransactionCheckStopped(transaction)
}

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

  // done is derived (deadline-based), so recompute each render; the poll re-renders until it flips true
  const done = !transaction || externalTransactionDone(transaction)
  useEffect(() => {
    if (done) {
      stopPolling()
      return
    }

    startPolling(NORMAL_POLL_INTERVAL_MS)
    return () => stopPolling()
  }, [startPolling, stopPolling, transaction?.id, done])

  if (error) {
    return <WalletErrorShell title='transaction unavailable' message={error.message} />
  }

  if (!transaction) {
    return <WalletErrorShell title='transaction not found' message='this wallet transaction could not be found' />
  }

  const isReceive = transaction.direction === 'RECEIVE'
  // The receive flow lands here, so the QR must show for any still-PAYABLE receive — including a
  // verification-less protocol (e.g. CLINK) whose row is a terminal-intent UNKNOWN (so we can't gate on
  // externalTransactionDone, which would hide a brand-new unverifiable invoice). "Payable" = not yet
  // SETTLED/FAILED and not past the bolt11 expiry; without the expiry check a CLINK receive stays
  // UNKNOWN forever and would keep showing a scannable QR for a long-dead invoice.
  const invoiceExpired = transaction.invoiceExpiresAt != null && new Date(transaction.invoiceExpiresAt) < new Date()
  const showReceiveQr = isReceive && transaction.bolt11 &&
    !TERMINAL_STATUSES.has(transaction.settlementStatus) && !invoiceExpired

  return (
    <TransactionDetailPage>
      <TransactionDetailHeading
        title={
          <TransactionHeadingTitle amount={formatMsatsToSats(transaction.amountMsats)}>
            {isReceive ? 'receive' : 'send'}
          </TransactionHeadingTitle>
        }
        walletInfo={transaction.walletInfo}
        identity={transaction.walletInfo ? undefined : 'external wallet'}
        status={<ExternalTransactionStatus transaction={transaction} className='justify-content-end' />}
        timestamp={transaction.settlementStatusChangedAt}
      />

      {showReceiveQr && (
        <TransactionDetailSection>
          <div className={transactionDetailStyles.qrContext}>
            <Qr
              value={transaction.bolt11}
              qrTransform={bolt11QrTransform}
              description={formatMsatsToSats(transaction.amountMsats)}
            />
          </div>
        </TransactionDetailSection>
      )}

      <UnknownDiagnostic transaction={transaction} />

      {(transaction.bolt11 || transaction.hash) && (
        <TransactionDetailSection title='invoice details'>
          <ExternalTransactionInvoiceDetails transaction={transaction} />
        </TransactionDetailSection>
      )}

      <TransactionDetailSection title='logs'>
        <WalletLogs
          externalTransactionId={Number(transaction.id)}
          poll={!externalTransactionDone(transaction)}
          pollInterval={NORMAL_POLL_INTERVAL_MS}
        />
      </TransactionDetailSection>
    </TransactionDetailPage>
  )
}

function UnknownDiagnostic ({ transaction }) {
  const message = externalTransactionDiagnosticMessage(transaction)
  if (!message) return null

  return (
    <Alert variant='warning' className='mb-0'>
      <div className='fw-bold'>status unknown</div>
      <div>{message}</div>
      {transaction.error && <small className='d-block mt-2 text-muted'>wallet detail: {transaction.error}</small>}
    </Alert>
  )
}

function ExternalTransactionInvoiceDetails ({ transaction }) {
  return (
    <Bolt11Info
      showAmount={false}
      extraChips={externalTransactionMetadataChips(transaction)}
      {...toBolt11InfoProps(externalTransactionBolt11InfoProps(transaction))}
    />
  )
}

function externalTransactionMetadataChips (transaction) {
  return [
    transaction.feeMsats != null && { key: 'fee', label: `fee ${formatMsatsToSats(transaction.feeMsats)}` },
    transaction.sourceValue && {
      key: 'source',
      prefix: externalTransactionSourcePrefix(transaction.sourceType),
      value: transaction.sourceValue
    }
  ].filter(Boolean)
}

function externalTransactionSourcePrefix (sourceType) {
  return sourceType?.toLowerCase().replace(/_/g, ' ') ?? 'source'
}
