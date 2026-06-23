import { useQuery } from '@apollo/client/react'
import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Alert } from 'react-bootstrap'
import AccordianItem from '@/components/accordian-item'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { formatSats, msatsToSatsDecimal } from '@/lib/format'
import { NORMAL_POLL_INTERVAL_MS } from '@/lib/constants'
import { timeSince } from '@/lib/time'
import { useData } from '@/components/use-data'
import { GET_EXTERNAL_WALLET_TRANSACTION } from '@/wallets/client/fragments'
import { WalletErrorShell, WalletLogs, WalletShellMain } from '@/wallets/client/components'
import { externalTransactionDiagnosticMessage } from '@/wallets/lib/external-transactions'

const TERMINAL_EXTERNAL_TRANSACTION_STATUSES = new Set(['SETTLED', 'FAILED'])

// a transaction stops changing once it's terminal, or once it's a "stopped" UNKNOWN (SN has given up
// rescheduling checks: nextStatusCheckAt null) — no point polling its logs after that.
function externalTransactionDone (transaction) {
  if (TERMINAL_EXTERNAL_TRANSACTION_STATUSES.has(transaction.settlementStatus)) return true
  return transaction.settlementStatus === 'UNKNOWN' && transaction.nextStatusCheckAt == null
}

export const getServerSideProps = getGetServerSideProps({
  query: GET_EXTERNAL_WALLET_TRANSACTION,
  variables: ({ id }) => ({ id: Number(id) }),
  authRequired: true
})

export default function ExternalWalletTransactionPage ({ ssrData }) {
  const router = useRouter()
  const id = Number(router.query.id)
  const { data, error, startPolling, stopPolling } = useQuery(GET_EXTERNAL_WALLET_TRANSACTION, {
    variables: { id },
    skip: !id
  })
  const dat = useData(data, ssrData)
  const transaction = dat?.externalWalletTransaction

  useEffect(() => {
    if (!transaction || externalTransactionDone(transaction)) {
      stopPolling()
      return
    }

    startPolling(NORMAL_POLL_INTERVAL_MS)
    return () => stopPolling()
  }, [startPolling, stopPolling, transaction?.id, transaction?.settlementStatus, transaction?.nextStatusCheckAt])

  if (error) {
    return <WalletErrorShell title='transaction unavailable' message={error.message} />
  }

  if (!transaction) {
    return <WalletErrorShell title='transaction not found' message='this wallet transaction could not be found' />
  }

  return (
    <WalletShellMain>
      <div className='py-3 w-100'>
        <div className='d-flex justify-content-between align-items-start gap-3'>
          <div>
            <h2 className='mb-1'>{transaction.direction === 'SEND' ? 'external send' : 'external receive'}</h2>
            <div className='text-muted'>
              {transaction.walletInfo
                ? (
                  <>
                    <Link href={`/wallets/${transaction.walletInfo.walletId}`}>{transaction.walletInfo.walletName}</Link>{' '}
                    via {transaction.walletInfo.protocolName}
                  </>
                  )
                : 'external wallet'}
            </div>
          </div>
          <div className='text-end'>
            <div className='fw-bold'>{transaction.settlementStatus.toLowerCase()}</div>
            <small className='text-muted' title={transaction.settlementStatusChangedAt} suppressHydrationWarning>
              {timeSince(new Date(transaction.settlementStatusChangedAt))}
            </small>
          </div>
        </div>

        <UnknownDiagnostic transaction={transaction} />

        <div className='mt-4 d-grid gap-2'>
          <Detail label='amount'>
            {transaction.amountMsats != null ? formatSats(msatsToSatsDecimal(transaction.amountMsats)) : 'N/A'}
          </Detail>
          {transaction.feeMsats != null && (
            <Detail label='fee'>
              {formatSats(msatsToSatsDecimal(transaction.feeMsats))}
            </Detail>
          )}
          <Detail label='hash'>
            <span className='text-monospace text-break'>{transaction.hash ?? 'hash deleted'}</span>
          </Detail>
          {transaction.sourceValue && <Detail label={transaction.sourceType?.toLowerCase() ?? 'source'}>{transaction.sourceValue}</Detail>}
          {transaction.providerTxId && <Detail label='provider tx'>{transaction.providerTxId}</Detail>}
          {transaction.settledAt && <Detail label='settled'>{new Date(transaction.settledAt).toLocaleString()}</Detail>}
          {transaction.invoiceExpiresAt && <Detail label='expires'>{new Date(transaction.invoiceExpiresAt).toLocaleString()}</Detail>}
          {!transaction.bolt11 && <Detail label='invoice'>invoice deleted</Detail>}
        </div>

        {transaction.bolt11 && (
          <div className='mt-4'>
            <AccordianItem
              header='lightning invoice'
              body={<div className='text-monospace text-break'>{transaction.bolt11}</div>}
            />
          </div>
        )}

        <div className='mt-4'>
          <h5 className='mb-3'>wallet logs</h5>
          <WalletLogs
            externalWalletTransactionId={Number(transaction.id)}
            poll={!externalTransactionDone(transaction)}
            pollInterval={NORMAL_POLL_INTERVAL_MS}
          />
        </div>
      </div>
    </WalletShellMain>
  )
}

function UnknownDiagnostic ({ transaction }) {
  const message = externalTransactionDiagnosticMessage(transaction)
  if (!message) return null

  return (
    <Alert variant='warning' className='mt-3 mb-0'>
      <div className='fw-bold'>status unknown</div>
      <div>{message}</div>
      {transaction.error && <small className='d-block mt-2 text-muted'>wallet detail: {transaction.error}</small>}
    </Alert>
  )
}

function Detail ({ label, children }) {
  return (
    <div className='d-flex flex-column flex-sm-row gap-1 gap-sm-3'>
      <div className='text-muted' style={{ minWidth: '7rem' }}>{label}</div>
      <div className='min-w-0'>{children}</div>
    </div>
  )
}
