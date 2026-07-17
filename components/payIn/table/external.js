import classNames from 'classnames'
import styles from './index.module.css'
import { timeSince } from '@/lib/time'
import { externalTransactionDiagnosticMessage } from '@/wallets/lib/external-transactions'
import LinkToContext from '@/components/link-to-context'
import Bolt11Info, { toBolt11InfoProps } from '../bolt11-info'
import { ExternalTransactionStatus } from '../external-transaction-status'
import { Bolt11Money } from './money'

export function ExternalTransactionRow ({ transaction }) {
  const isSend = transaction.direction === 'SEND'
  const href = `/wallets/transactions/${transaction.id}`
  const diagnostic = externalTransactionDiagnosticMessage(transaction)
  const failed = ['FAILED', 'EXPIRED'].includes(transaction.status)
  return (
    <div
      className={classNames(styles.row, {
        [styles.stacking]: !isSend && transaction.status === 'SETTLED',
        [styles.failed]: failed
      })}
    >
      <LinkToContext className={styles.type} href={href}>
        <small className='text-muted' title={transaction.createdAt} suppressHydrationWarning>{timeSince(new Date(transaction.createdAt))}</small>
        <small className='text-muted'>{isSend ? 'send' : 'receive'}</small>
        <ExternalTransactionStatus transaction={transaction} />
      </LinkToContext>
      <LinkToContext className={styles.context} href={href}>
        <ExternalTransactionContext transaction={transaction} diagnostic={diagnostic} />
      </LinkToContext>
      <LinkToContext className={styles.money} href={href}>
        <ExternalTransactionMoney transaction={transaction} />
      </LinkToContext>
    </div>
  )
}

function ExternalTransactionContext ({ transaction, diagnostic }) {
  if (transaction.bolt11 || transaction.hash) {
    return (
      <div className='mw-100'>
        {transaction.sourceType === 'LN_ADDR' && transaction.sourceValue &&
          <small className='d-block text-muted text-truncate' title={transaction.sourceValue}>to {transaction.sourceValue}</small>}
        <div className='d-none d-sm-block'>
          <Bolt11Info
            showAmount={false}
            {...toBolt11InfoProps(transaction)}
          />
        </div>
        {diagnostic && <small className='d-block text-warning text-truncate' title={diagnostic}>{diagnostic}</small>}
      </div>
    )
  }

  return (
    <div className='text-truncate mw-100'>
      <span>external transaction #{transaction.id}</span>
      <small className='d-block text-muted text-monospace text-truncate'>hash deleted</small>
      {diagnostic && <small className='d-block text-warning text-truncate' title={diagnostic}>{diagnostic}</small>}
    </div>
  )
}

function ExternalTransactionMoney ({ transaction }) {
  const mtokens = externalTransactionMtokens(transaction)
  return mtokens != null ? <Bolt11Money mtokens={mtokens} /> : <div>N/A</div>
}

export function externalTransactionMtokens (transaction) {
  const msats = transaction.settledMsats ?? transaction.amountMsats
  if (msats == null) return null
  return transaction.direction === 'SEND' ? -BigInt(msats) : BigInt(msats)
}
