import { Button } from 'react-bootstrap'
import CancelButton from '@/components/cancel-button'
import { SubmitButton } from '@/components/form'
import { isConfigured } from '@/wallets/common'

// TODO(wallet-v2): will we still need this?
//
// see WalletCard component for context
export default function WalletButtonBar ({
  wallet, disable,
  className, children, onDelete, onCancel, hasCancel = true,
  createText = 'attach', deleteText = 'detach', editText = 'save'
}) {
  return (
    <div className={`mt-3 ${className}`}>
      <div className='d-flex justify-content-between'>
        {isConfigured(wallet) && wallet.def.requiresConfig &&
          <Button onClick={onDelete} variant='grey-medium'>{deleteText}</Button>}
        {children}
        <div className='d-flex align-items-center ms-auto'>
          {hasCancel && <CancelButton onClick={onCancel} />}
          <SubmitButton variant='primary' disabled={disable}>{isConfigured(wallet) ? editText : createText}</SubmitButton>
        </div>
      </div>
    </div>
  )
}
