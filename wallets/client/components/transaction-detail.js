import classNames from 'classnames'
import { timeSince } from '@/lib/time'
import { WalletDetailPage, WalletPageHeading } from './layout'
import styles from './transaction-detail.module.css'

export function TransactionDetailPage ({ children }) {
  return <WalletDetailPage className={styles.page}>{children}</WalletDetailPage>
}

export function TransactionDetailHeading ({ title, amount, walletInfo, identity, status, timestamp }) {
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
      title={
        <>
          {title}
          {amount && <span className={styles.headingAmount}>{amount}</span>}
        </>
      }
      wallet={wallet}
      identity={identity}
      href={href}
      aside={aside}
    />
  )
}

export function TransactionDetailSection ({ title, children, className }) {
  if (!children) return null

  return (
    <section className={classNames('d-flex flex-column', className)} style={{ gap: 'var(--wt-gap-md)' }}>
      {title && <h5 className='m-0'>{title}</h5>}
      {children}
    </section>
  )
}
