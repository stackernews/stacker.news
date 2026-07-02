import classNames from 'classnames'
import { timeSince } from '@/lib/time'
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
