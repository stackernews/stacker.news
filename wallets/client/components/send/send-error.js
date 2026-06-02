import { Alert } from 'react-bootstrap'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import sendStyles from './send.module.css'
import classNames from 'classnames'
const styles = { ...sharedStyles, ...sendStyles }

export function WalletSendError ({ error, onDismiss }) {
  if (!error) return null

  return (
    <Alert variant={error.variant} dismissible onClose={onDismiss} className={classNames(styles.fields, 'mt-3 mb-0')}>
      <div className='fw-bold'>{error.title}</div>
      {error.message && <div>{error.message}</div>}
    </Alert>
  )
}

export function sendErrorDisplay (err) {
  // sendWalletPayment sets settledUnknown unless the error proves the payment
  // didn't happen (provider rejection or pre-payment validation/config error);
  // only proven failures render as a clean, safe-to-retry failure.
  if (err?.settledUnknown) {
    return {
      variant: 'warning',
      title: 'payment may still be in flight',
      message: 'your wallet did not respond in time. check your wallet and balance before retrying to avoid double-paying.'
    }
  }
  return {
    variant: 'danger',
    title: 'payment failed',
    message: err?.message || err?.toString?.() || 'try again or check this wallet\'s logs'
  }
}
