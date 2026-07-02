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
  return {
    variant: 'danger',
    title: 'payment failed',
    message: err?.message || err?.toString?.() || 'try again or check this wallet\'s logs'
  }
}
