import Moon from '@/svgs/moon-fill.svg'
import { useMe } from '@/components/me'
import { useEffect, useState } from 'react'
import { WalletDetailPage, WalletShellMain } from './layout'
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

function CenteredPrompt ({ children }) {
  return (
    <WalletShellMain>
      <div className='py-5 px-3 px-md-0 w-100 d-flex flex-column align-items-center justify-content-center flex-grow-1 mx-auto' style={{ maxWidth: '500px' }}>
        {children}
      </div>
    </WalletShellMain>
  )
}

export function WalletErrorShell ({ title, message }) {
  return (
    <WalletShellMain>
      <div className='py-5 text-center d-flex flex-column align-items-center justify-content-center flex-grow-1'>
        <span className='text-muted fw-bold my-1'>{title}</span>
        <small className='d-block text-muted'>
          {message}
        </small>
      </div>
    </WalletShellMain>
  )
}

export function WalletLoadingShell ({ message = 'loading wallets' }) {
  return (
    <WalletShellMain mobileTopBar={false}>
      <div className='py-5 text-center d-flex flex-column align-items-center justify-content-center flex-grow-1 text-muted'>
        <Moon className='spin fill-grey' height={28} width={28} />
        <small className='d-block mt-3 text-muted'>{message}</small>
      </div>
    </WalletShellMain>
  )
}

export function WalletRoutePage ({
  ready,
  resource,
  notFoundMessage = 'this wallet could not be found',
  children
}) {
  return (
    <WalletRouteGate>
      {!ready
        ? <WalletLoadingShell />
        : !resource
            ? <WalletErrorShell title='wallet not found' message={notFoundMessage} />
            : children(resource)}
    </WalletRouteGate>
  )
}

export function WalletDetailRoutePage ({ ready, resource, title, notFoundMessage, children }) {
  return (
    <WalletRoutePage ready={ready} resource={resource} notFoundMessage={notFoundMessage}>
      {wallet => (
        <WalletDetailPage wallet={wallet} title={title}>
          {children(wallet)}
        </WalletDetailPage>
      )}
    </WalletRoutePage>
  )
}

export function WalletRouteGate ({ children, walletsRequired = true }) {
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

  if (!walletsRequired) return children

  const wrongKey = keyError === WRONG_KEY
  const showPassphrase = me?.privates?.showPassphrase
  const canRecoverReceiveOnlyPassphrase = wrongKey && showPassphrase && !me?.privates?.hasSendWallet

  if (keyError === KEY_STORAGE_UNAVAILABLE) {
    const insecureContext = typeof window !== 'undefined' && window.isSecureContext === false
    return (
      <WalletErrorShell
        title='wallets unavailable'
        message={insecureContext
          ? 'wallets require a secure (HTTPS) connection on this device'
          : 'this device does not support storage of cryptographic keys via IndexedDB'}
      />
    )
  }

  if (canRecoverReceiveOnlyPassphrase && walletSendReady) {
    return <CenteredPrompt><WalletPassphraseSetup /></CenteredPrompt>
  }

  if (wrongKey) {
    if (canRecoverReceiveOnlyPassphrase && !walletsError && !walletSendReady) {
      return <WalletLoadingShell />
    }
    return (
      <CenteredPrompt>
        <WalletPassphrasePrompt showCancel={false} onSuccess={() => setJustUnlocked(true)} />
      </CenteredPrompt>
    )
  }

  if (walletsError) {
    return (
      <WalletErrorShell
        title='failed to load wallets'
        message={walletsError.message ?? 'unknown error'}
      />
    )
  }

  if (!key || keySyncInProgress || !walletSendReady) {
    return <WalletLoadingShell />
  }

  if (showPassphrase && !justUnlocked) {
    return <CenteredPrompt><WalletPassphraseSetup /></CenteredPrompt>
  }

  return children
}
