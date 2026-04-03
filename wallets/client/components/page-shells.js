import Moon from '@/svgs/moon-fill.svg'
import { WalletLayout } from './layout'

export function WalletCenteredPromptShell ({ children }) {
  return (
    <WalletLayout>
      <div className='py-5 d-flex flex-column align-items-center justify-content-center flex-grow-1 mx-auto' style={{ maxWidth: '500px' }}>
        {children}
      </div>
    </WalletLayout>
  )
}

export function WalletErrorShell ({ title, message }) {
  return (
    <WalletLayout>
      <div className='py-5 text-center d-flex flex-column align-items-center justify-content-center flex-grow-1'>
        <span className='text-muted fw-bold my-1'>{title}</span>
        <small className='d-block text-muted'>
          {message}
        </small>
      </div>
    </WalletLayout>
  )
}

export function WalletLoadingShell ({ message = 'loading wallets' }) {
  return (
    <WalletLayout>
      <div className='py-5 text-center d-flex flex-column align-items-center justify-content-center flex-grow-1 text-muted'>
        <Moon className='spin fill-grey' height={28} width={28} />
        <small className='d-block mt-3 text-muted'>{message}</small>
      </div>
    </WalletLayout>
  )
}

export function WalletKeyStorageUnavailableShell () {
  return (
    <WalletErrorShell
      title='wallets unavailable'
      message='this device does not support storage of cryptographic keys via IndexedDB'
    />
  )
}
