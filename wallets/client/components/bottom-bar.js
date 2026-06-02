import { useRouter } from 'next/router'
import classNames from 'classnames'
import styles from './wallet.module.css'
import BackArrow from '@/svgs/arrow-left-line.svg'

// Shared wallet footer: a history-back control plus a right-aligned action (children).
// Back is always router.back() — wallet screens are only reached from their parent
// page, so there's no deterministic "up" href for both saved wallets and templates.
export function WalletBottomBar ({ className, children }) {
  const router = useRouter()
  return (
    <div className={classNames(styles.walletBottomBar, className)}>
      <button
        type='button'
        className={classNames(styles.textButton, styles.walletFooterBackButton)}
        onClick={() => router.back()}
        aria-label='back'
      >
        <BackArrow className='theme' width={24} height={24} />
        back
      </button>
      {children}
    </div>
  )
}
