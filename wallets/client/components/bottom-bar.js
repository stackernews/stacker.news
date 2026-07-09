import { useRouter } from 'next/router'
import classNames from 'classnames'
import styles from './wallet.module.css'
import BackArrow from '@/svgs/arrow-left-line.svg'

// Shared wallet footer: a back control plus a right-aligned action (children).
// Wallet screens default to history navigation, while contained flows can provide
// an explicit previous-step action.
export function WalletBottomBar ({ className, children, onBack, backDisabled = false, backText = 'back' }) {
  const router = useRouter()
  return (
    <div className={classNames(styles.walletBottomBar, className)}>
      <button
        type='button'
        className={classNames(styles.textButton, styles.walletFooterBackButton)}
        onClick={onBack ?? (() => router.back())}
        disabled={backDisabled}
        aria-label={backText}
      >
        <BackArrow className='theme' width={24} height={24} />
        {backText}
      </button>
      {children}
    </div>
  )
}
