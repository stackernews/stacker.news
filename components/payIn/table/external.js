import classNames from 'classnames'
import styles from './index.module.css'
import { formatSats, msatsToSatsDecimal } from '@/lib/format'
import { timeSince } from '@/lib/time'
import { externalTransactionDiagnosticMessage } from '@/wallets/lib/external-transactions'
import LinkToContext from '@/components/link-to-context'

export function ExternalWalletTransactionRow ({ transaction }) {
  const isSend = transaction.direction === 'SEND'
  const href = `/wallets/transactions/${transaction.id}`
  const diagnostic = externalTransactionDiagnosticMessage(transaction)
  const hashLabel = transaction.hash ?? 'hash deleted'
  return (
    <div
      className={classNames(styles.row, {
        [styles.failed]: transaction.settlementStatus === 'FAILED',
        [styles.spending]: isSend,
        [styles.stacking]: !isSend
      })}
    >
      <LinkToContext className={styles.type} href={href}>
        <small className='text-muted' title={transaction.settlementStatusChangedAt} suppressHydrationWarning>{timeSince(new Date(transaction.settlementStatusChangedAt))}</small>
        <small>{isSend ? 'external send' : 'external receive'}</small>
        <small className='text-muted'>{transaction.settlementStatus.toLowerCase()}</small>
      </LinkToContext>
      <LinkToContext className={styles.context} href={href}>
        <div className='text-truncate mw-100'>
          <span>{externalTransactionContext(transaction)}</span>
          <small className='d-block text-muted text-monospace text-truncate' title={transaction.hash ?? undefined}>{hashLabel}</small>
          {diagnostic && <small className='d-block text-warning text-truncate' title={diagnostic}>{diagnostic}</small>}
        </div>
      </LinkToContext>
      <LinkToContext className={styles.money} href={href}>
        {transaction.amountMsats != null
          ? <div>{formatSats(msatsToSatsDecimal(transaction.amountMsats))}</div>
          : <div>N/A</div>}
        {transaction.feeMsats != null &&
          <small className='text-muted'>
            fee {formatSats(msatsToSatsDecimal(transaction.feeMsats))}
          </small>}
      </LinkToContext>
    </div>
  )
}

function externalTransactionContext (transaction) {
  if (transaction.sourceType === 'LN_ADDR' && transaction.sourceValue) return transaction.sourceValue
  if (transaction.sourceValue) return transaction.sourceValue
  if (transaction.hash) return `${transaction.hash.slice(0, 12)}...${transaction.hash.slice(-8)}`
  return `external transaction #${transaction.id}`
}
