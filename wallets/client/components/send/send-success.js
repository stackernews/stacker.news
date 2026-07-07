import Link from 'next/link'
import classNames from 'classnames'
import { buttonClasses } from '@/components/ui/button'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import sendStyles from './send.module.css'
const styles = { ...sharedStyles, ...sendStyles }

export function SendSuccess ({ sent, backHref }) {
  return (
    <div className={`flex flex-col flex-auto ${styles.success}`}>
      <div className='flex flex-col items-center max-w-full m-0 gap-6'>
        <div className={classNames(styles.sentSummary, 'flex flex-col items-center max-w-full')}>
          <div className={classNames(styles.sentLabel, 'text-muted')}>sent</div>
          <div className={classNames(styles.sentAmount, 'flex items-end')}>
            {new Intl.NumberFormat().format(sent.sats)}
            <span className={classNames(styles.sentAmountUnit, 'text-muted')}>sats</span>
          </div>
          <div className={classNames(styles.sentTo, 'text-muted text-center')}>
            to <span className={styles.sentDest} title={sent.to}>{sent.to}</span>
          </div>
        </div>
        <Link href={backHref} className={buttonClasses({ variant: 'secondary' })}>
          back to wallet
        </Link>
      </div>
    </div>
  )
}
