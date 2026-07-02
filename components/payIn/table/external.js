import classNames from 'classnames'
import styles from './index.module.css'
import { formatMsatsToSats } from '@/lib/format'
import { timeSince } from '@/lib/time'
import { externalTransactionDiagnosticMessage, externalTransactionBolt11InfoProps } from '@/wallets/lib/external-transactions'
import LinkToContext from '@/components/link-to-context'
import Bolt11Info, { toBolt11InfoProps } from '../bolt11-info'
import { ExternalTransactionStatus } from '../external-transaction-status'
import Plug from '@/svgs/plug.svg'

export function ExternalTransactionRow ({ transaction }) {
  const isSend = transaction.direction === 'SEND'
  const href = `/wallets/transactions/${transaction.id}`
  const diagnostic = externalTransactionDiagnosticMessage(transaction)
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
        <small>{isSend ? 'send' : 'receive'}</small>
        <ExternalTransactionStatus transaction={transaction} />
      </LinkToContext>
      <LinkToContext className={styles.context} href={href}>
        {transaction.bolt11 || transaction.hash
          ? (
            <div className='mw-100'>
              <Bolt11Info
                showAmount={false}
                {...toBolt11InfoProps(externalTransactionBolt11InfoProps(transaction))}
              />
              {diagnostic && <small className='d-block text-warning text-truncate' title={diagnostic}>{diagnostic}</small>}
            </div>
            )
          : (
            <div className='text-truncate mw-100'>
              <span>{transaction.sourceValue || `external transaction #${transaction.id}`}</span>
              <small className='d-block text-muted text-monospace text-truncate' title={transaction.hash ?? undefined}>{transaction.hash ?? 'hash deleted'}</small>
              {diagnostic && <small className='d-block text-warning text-truncate' title={diagnostic}>{diagnostic}</small>}
            </div>
            )}
      </LinkToContext>
      <LinkToContext className={styles.money} href={href}>
        {transaction.amountMsats != null
          ? (
            <div className='d-flex align-items-center gap-1 justify-content-end'>
              {formatMsatsToSats(transaction.amountMsats)}
              <Plug className='fill-muted' width={10} height={10} />
            </div>
            )
          : <div>N/A</div>}
        {transaction.feeMsats != null &&
          <small className='text-muted'>
            fee {formatMsatsToSats(transaction.feeMsats)}
          </small>}
      </LinkToContext>
    </div>
  )
}
