import { Alert } from '@/components/ui/alert'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import sendStyles from './send.module.css'
import classNames from 'classnames'
const styles = { ...sharedStyles, ...sendStyles }

export function WalletSendError ({ error, onDismiss }) {
  if (!error) return null

  return (
    <Alert variant={error.variant} dismissible onClose={onDismiss} className={classNames(styles.fields, 'mt-4 mb-0')}>
      <div className='font-bold'>{error.title}</div>
      {error.message && <div>{error.message}</div>}
    </Alert>
  )
}
