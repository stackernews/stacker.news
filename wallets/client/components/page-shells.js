import Moon from '@/svgs/moon-fill.svg'
import { useMemo } from 'react'
import { useMe } from '@/components/me'
import { WalletLayout } from './layout'
import { WalletPassphrasePrompt, WalletPassphraseSetup } from './passphrase'
import {
  KEY_STORAGE_UNAVAILABLE,
  WRONG_KEY,
  useKey,
  useKeyError,
  useKeySyncInProgress,
  useWalletsError,
  useWalletPageLoading
} from '../hooks/global'

const WalletPageGate = {
  KEY_STORAGE_UNAVAILABLE: 'KEY_STORAGE_UNAVAILABLE',
  LOCKED: 'LOCKED',
  ERROR: 'ERROR',
  LOADING: 'LOADING',
  SETUP_REQUIRED: 'SETUP_REQUIRED',
  READY: 'READY'
}

function deriveVaultPageState ({
  hasLocalKey,
  keyError,
  keySyncInProgress,
  walletPageLoading,
  walletsError,
  needsPassphraseSetup,
  pageError
}) {
  if (keyError === KEY_STORAGE_UNAVAILABLE) return WalletPageGate.KEY_STORAGE_UNAVAILABLE
  if (keyError === WRONG_KEY) return WalletPageGate.LOCKED
  if (pageError || walletsError) return WalletPageGate.ERROR
  if (!hasLocalKey || keySyncInProgress || walletPageLoading) return WalletPageGate.LOADING
  if (needsPassphraseSetup) return WalletPageGate.SETUP_REQUIRED
  return WalletPageGate.READY
}

function useVaultController () {
  const { me } = useMe()
  const key = useKey()
  const keyError = useKeyError()
  const keySyncInProgress = useKeySyncInProgress()
  const walletPageLoading = useWalletPageLoading()
  const walletsError = useWalletsError()
  const showPassphrase = !!me?.privates?.showPassphrase
  const error = walletsError ?? null

  const pageGate = useMemo(() => {
    return deriveVaultPageState({
      hasLocalKey: !!key,
      keyError,
      walletPageLoading,
      walletsError,
      needsPassphraseSetup: showPassphrase,
      keySyncInProgress,
      pageError: error
    })
  }, [key, keyError, walletPageLoading, walletsError, showPassphrase, keySyncInProgress, error])

  return useMemo(() => ({
    pageGate,
    error
  }), [pageGate, error])
}

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

export function WalletPageGateShell ({
  pageGate,
  error,
  errorTitle = 'failed to load wallets',
  loadingMessage = 'loading wallets',
  lockedPrompt,
  setupPrompt,
  children
}) {
  if (pageGate === WalletPageGate.KEY_STORAGE_UNAVAILABLE) {
    return <WalletKeyStorageUnavailableShell />
  }

  if (pageGate === WalletPageGate.LOCKED) {
    return (
      <WalletCenteredPromptShell>
        {lockedPrompt}
      </WalletCenteredPromptShell>
    )
  }

  if (pageGate === WalletPageGate.ERROR) {
    return (
      <WalletErrorShell
        title={errorTitle}
        message={error?.message ?? 'unknown error'}
      />
    )
  }

  if (pageGate === WalletPageGate.LOADING) {
    return <WalletLoadingShell message={loadingMessage} />
  }

  if (pageGate === WalletPageGate.SETUP_REQUIRED) {
    return (
      <WalletCenteredPromptShell>
        {setupPrompt}
      </WalletCenteredPromptShell>
    )
  }

  return children
}

export function WalletRouteGateShell ({ children, errorTitle, loadingMessage }) {
  const { error, pageGate } = useVaultController()

  return (
    <WalletPageGateShell
      pageGate={pageGate}
      error={error}
      errorTitle={errorTitle}
      loadingMessage={loadingMessage}
      lockedPrompt={<WalletPassphrasePrompt showCancel={false} />}
      setupPrompt={<WalletPassphraseSetup />}
    >
      {children}
    </WalletPageGateShell>
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
