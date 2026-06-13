import Link from 'next/link'
import classNames from 'classnames'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import sendStyles from './send.module.css'
const styles = { ...sharedStyles, ...sendStyles }

export function SendSuccess ({ sent, backHref }) {
  return (
    <div className={`d-flex flex-column flex-fill ${styles.success}`}>
      <div className='d-flex flex-column align-items-center mw-100 m-0 gap-4'>
        <div className={classNames(styles.sentSummary, 'd-flex flex-column align-items-center mw-100')}>
          <div className={classNames(styles.sentLabel, 'text-muted')}>sent</div>
          <div className={classNames(styles.sentAmount, 'd-flex align-items-end')}>
            {new Intl.NumberFormat().format(sent.sats)}
            <span className={classNames(styles.sentAmountUnit, 'text-muted')}>sats</span>
          </div>
          <div className={classNames(styles.sentTo, 'text-muted text-center')}>
            to <span className={styles.sentDest} title={sent.to}>{sent.to}</span>
          </div>
        </div>
        <Link href={backHref} className='btn btn-secondary'>
          back to wallet
        </Link>
      </div>
    </div>
  )
}
