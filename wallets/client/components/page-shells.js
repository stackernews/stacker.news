import Moon from '@/svgs/moon-fill.svg'
import { useMe } from '@/components/me'
import { useEffect, useState } from 'react'
import { WalletLayout } from './layout'
import { WalletPassphrasePrompt, WalletPassphraseSetup } from './passphrase'
import {
  KEY_STORAGE_UNAVAILABLE,
  WRONG_KEY,
  useKey,
  useKeyError,
  useKeySyncInProgress,
  useWalletsError,
  useWalletSendReady
} from '../hooks/global'

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

export function WalletRouteGateShell ({ children, errorTitle, loadingMessage }) {
  const { me } = useMe()
  const [justUnlocked, setJustUnlocked] = useState(false)
  const key = useKey()
  const keyError = useKeyError()
  const keySyncInProgress = useKeySyncInProgress()
  const walletSendReady = useWalletSendReady()
  const walletsError = useWalletsError()

  useEffect(() => {
    setJustUnlocked(false)
  }, [me?.id])

  useEffect(() => {
    if (!me?.privates?.showPassphrase) {
      setJustUnlocked(false)
    }
  }, [me?.privates?.showPassphrase])

  if (keyError === KEY_STORAGE_UNAVAILABLE) {
    return <WalletKeyStorageUnavailableShell />
  }

  if (keyError === WRONG_KEY) {
    return (
      <WalletCenteredPromptShell>
        <WalletPassphrasePrompt showCancel={false} onSuccess={() => setJustUnlocked(true)} />
      </WalletCenteredPromptShell>
    )
  }

  if (walletsError) {
    return (
      <WalletErrorShell
        title={errorTitle ?? 'failed to load wallets'}
        message={walletsError.message ?? 'unknown error'}
      />
    )
  }

  if (!key || keySyncInProgress || !walletSendReady) {
    return <WalletLoadingShell message={loadingMessage} />
  }

  if (me?.privates?.showPassphrase && !justUnlocked) {
    return (
      <WalletCenteredPromptShell>
        <WalletPassphraseSetup />
      </WalletCenteredPromptShell>
    )
  }

  return children
}

export function WalletKeyStorageUnavailableShell () {
  return (
    <WalletErrorShell
      title='wallets unavailable'
      message='this device does not support storage of cryptographic keys via IndexedDB'
    />
  )
}
