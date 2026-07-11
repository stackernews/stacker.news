import { Fragment } from 'react'
import classNames from 'classnames'
import { timeSince } from '@/lib/time'
import { formatMsatsToSats } from '@/lib/format'
import { useTimeSince } from '@/components/use-time-since'
import { LEDGER_SOURCE, entryNetMsats } from '@/wallets/lib/external-transaction-ledger'
import { WalletPageHeading, WalletShellMain } from './layout'
import styles from './transaction-detail.module.css'

export function TransactionDetailPage ({ children }) {
  return (
    <WalletShellMain>
      <div className={styles.page}>
        {children}
      </div>
    </WalletShellMain>
  )
}

export function TransactionDetailHeading ({ title, walletInfo, identity, status, timestamp }) {
  const wallet = walletInfo ? { name: walletInfo.walletName } : undefined
  const href = walletInfo ? `/wallets/${walletInfo.walletId}` : undefined
  const aside = (status || timestamp) && (
    <>
      {status}
      {timestamp && (
        <small className='d-block text-muted' title={timestamp} suppressHydrationWarning>
          {timeSince(new Date(timestamp))}
        </small>
      )}
    </>
  )

  return (
    <WalletPageHeading
      title={title}
      wallet={wallet}
      identity={identity}
      href={href}
      aside={aside}
    />
  )
}

export function TransactionHeadingTitle ({ children, amount }) {
  return (
    <>
      {children}
      {amount && <span className={styles.headingAmount}>{amount}</span>}
    </>
  )
}

export function TransactionDetailSection ({ title, children, className }) {
  if (!children) return null

  return (
    <section className={classNames(styles.section, className)}>
      {title && <h5>{title}</h5>}
      {children}
    </section>
  )
}

export const transactionDetailStyles = styles

export function ExternalTransactionLedger ({ entries, currentBalanceMsats }) {
  if (!entries?.length) {
    return (
      <div className={styles.ledger}>
        <div className={styles.ledgerEmpty}>no accounting entries</div>
      </div>
    )
  }

  return (
    <div className={styles.ledger}>
      <span />
      <span />
      <span className={styles.ledgerHeading}>billed</span>
      <span className={styles.ledgerHeading}>settled</span>
      <span className={styles.ledgerHeading}>balance</span>
      {entries.map(entry => {
        const netMsats = entryNetMsats(entry)
        const isAccrual = entry.source === LEDGER_SOURCE.ACCRUAL
        return (
          <Fragment key={entry.id}>
            <LedgerTimestamp createdAt={entry.createdAt} />
            <span className={styles.ledgerType}>{entry.type.toLowerCase()}</span>
            <LedgerAmount msats={isAccrual ? netMsats : null} />
            <LedgerAmount msats={isAccrual ? null : -netMsats} />
            <LedgerAmount msats={entry.balanceMsats} />
          </Fragment>
        )
      })}
      <span className={styles.ledgerTotalLabel}>current balance</span>
      <LedgerAmount className={styles.ledgerTotal} msats={currentBalanceMsats} />
    </div>
  )
}

function LedgerAmount ({ msats, className }) {
  return (
    <span className={classNames(styles.ledgerAmount, className)}>
      {msats == null ? '' : formatMsatsToSats(msats)}
    </span>
  )
}

function LedgerTimestamp ({ createdAt }) {
  const time = useTimeSince(createdAt)

  return (
    <span className={styles.ledgerTimestamp} title={createdAt} suppressHydrationWarning>
      {time}
    </span>
  )
}
