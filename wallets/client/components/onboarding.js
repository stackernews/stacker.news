import { useCallback, useEffect, useRef, useState } from 'react'
import { useApolloClient, useMutation } from '@apollo/client/react'
import { Button } from 'react-bootstrap'
import classNames from 'classnames'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMe } from '@/components/me'
import { requestPersistentStorage } from '@/components/use-indexeddb'
import { withTimeoutSignal } from '@/lib/time'
import { WALLET_SEND_PAYMENT_TIMEOUT_MS } from '@/lib/constants'
import { ME } from '@/fragments/users'
import { WalletShellMain } from './layout'
import { WalletLoadingShell, WalletRouteGate } from './page-shells'
import { WalletLogo } from './wallet-logo'
import { useEncryption } from '@/wallets/client/hooks/crypto'
import { protocolTestSendPayment } from '@/wallets/client/protocols'
import { clearWalletBalanceCache } from '@/wallets/client/balance'
import {
  CREATE_EMBEDDED_SPARK_WALLET,
  TEST_WALLET_RECV_PROTOCOL,
  WALLETS
} from '@/wallets/client/fragments'
import Moon from '@/svgs/moon-fill.svg'
import ArrowRight from '@/svgs/arrow-right-line.svg'
import CheckCircle from '@/svgs/checkbox-circle-fill.svg'
import { selectedWalletRoute } from '@/wallets/lib/routes'
import { isSafeRedirectPath } from '@/lib/safe-url'
import sharedStyles from './wallet.module.css'
import onboardingStyles from './onboarding.module.css'
const styles = { ...sharedStyles, ...onboardingStyles }

export function WalletOnboarding () {
  const { me } = useMe()
  const router = useRouter()
  const [path, setPath] = useState(null)
  const [completedWalletId, setCompletedWalletId] = useState(null)
  const returnedWalletId = typeof router.query.walletId === 'string' && /^[1-9]\d*$/.test(router.query.walletId)
    ? router.query.walletId
    : null
  const returnTo = typeof router.query.returnTo === 'string' &&
    isSafeRedirectPath(router.query.returnTo) &&
    !router.query.returnTo.startsWith('/onboarding/wallet')
    ? router.query.returnTo
    : null
  const setupComplete = completedWalletId || returnedWalletId
  const alreadyHasWallet = me?.privates?.hasSendWallet || me?.privates?.hasRecvWallet

  useEffect(() => {
    if (alreadyHasWallet && !setupComplete) router.replace(returnTo || '/')
  }, [alreadyHasWallet, returnTo, router, setupComplete])

  useEffect(() => {
    if (path === 'external' && me?.privates?.showPassphrase === false) {
      router.push({
        pathname: '/wallets/add',
        query: { onboarding: '1', ...(returnTo && { returnTo }) }
      })
    }
  }, [me?.privates?.showPassphrase, path, returnTo, router])

  if (!me || (alreadyHasWallet && !setupComplete)) {
    return <WalletLoadingShell message='loading wallet setup' />
  }

  if (setupComplete) {
    return <WalletOnboardingSuccess walletId={setupComplete} returnTo={returnTo} />
  }

  if (!path) {
    return (
      <OnboardingShell>
        <div className={styles.heading}>
          <div className={styles.eyebrow}>Step 1 of 3</div>
          <h1>Do you need a lightning wallet?</h1>
          <p>A lightning wallet lets you receive bitcoin for your posts and comments.</p>
        </div>

        <div className={styles.choices}>
          <button type='button' className={classNames(styles.surfaceRow, styles.surfaceRowHover, styles.choice)} onClick={() => setPath('embedded')}>
            <div className={styles.choiceHeader}>
              <span className={styles.choiceTitle}>Yes, create one</span>
              <WalletLogo name='SPARK' fallback='name' height={18} className={styles.sparkLogo} fallbackClassName={styles.sparkName} />
            </div>
            <span>
              <strong>Treat it like a custodial wallet:</strong> Spark can see your IP address and wallet activity, and access to this wallet depends on Spark.
            </span>
            <ArrowRight className={styles.choiceArrow} width={20} height={20} />
          </button>
          <button type='button' className={classNames(styles.surfaceRow, styles.surfaceRowHover, styles.choice)} onClick={() => setPath('external')}>
            <span className={styles.choiceTitle}>No, I have one</span>
            <span>Connect Alby, Blink, Coinos, LNbits, Phoenixd, and other wallets.</span>
            <ArrowRight className={styles.choiceArrow} width={20} height={20} />
          </button>
        </div>

        <button type='button' className={classNames(styles.textButton, styles.skip)} onClick={() => router.replace(returnTo || '/')}>
          <span>Skip for now</span>
          <small>You can create or connect a wallet anytime.</small>
        </button>
      </OnboardingShell>
    )
  }

  return (
    <WalletRouteGate
      passphraseSetupProps={{
        onBack: () => setPath(null),
        confirmText: 'Continue'
      }}
    >
      {path === 'embedded'
        ? <EmbeddedSparkProvision onSuccess={setCompletedWalletId} />
        : <WalletLoadingShell message='opening wallet setup' />}
    </WalletRouteGate>
  )
}

function EmbeddedSparkProvision ({ onSuccess }) {
  const client = useApolloClient()
  const { encrypt } = useEncryption()
  const [testReceive] = useMutation(TEST_WALLET_RECV_PROTOCOL)
  const [createWallet] = useMutation(CREATE_EMBEDDED_SPARK_WALLET)
  const abortController = useRef(null)
  const [error, setError] = useState(null)

  const provision = useCallback(async () => {
    abortController.current?.abort()
    setError(null)
    const controller = new AbortController()
    abortController.current = controller

    try {
      const { mnemonic, identityPubkey } = await withTimeoutSignal(
        WALLET_SEND_PAYMENT_TIMEOUT_MS,
        signal => protocolTestSendPayment({ name: 'SPARK' }, {}, { signal }),
        { parentSignal: controller.signal }
      )

      await testReceive({
        variables: { config: { walletRecvSpark: { identityPubkey } } },
        context: { fetchOptions: { signal: controller.signal } }
      })
      const encryptedMnemonic = await encrypt(mnemonic)
      const { data } = await createWallet({
        variables: {
          input: { mnemonic: encryptedMnemonic, identityPubkey }
        },
        context: { fetchOptions: { signal: controller.signal } }
      })
      const walletId = data?.createEmbeddedSparkWallet?.id
      if (!walletId) throw new Error('wallet saved without an id')

      requestPersistentStorage()
      clearWalletBalanceCache()
      onSuccess(walletId)
      client.refetchQueries({ include: [ME, WALLETS] }).catch(err => {
        console.error('failed to refresh wallet state:', err)
      })
    } catch (err) {
      if (controller.signal.aborted) return
      console.error('failed to create embedded wallet:', err)
      setError(err.message || 'failed to create wallet')
    } finally {
      if (abortController.current === controller) abortController.current = null
    }
  }, [client, createWallet, encrypt, onSuccess, testReceive])

  useEffect(() => {
    provision()
    return () => abortController.current?.abort()
  }, [provision])

  return (
    <OnboardingShell narrow>
      <div className={classNames(styles.heading, 'text-center')}>
        <div className={styles.eyebrow}>Finishing setup</div>
        <Moon className='spin fill-grey mb-3' height={32} width={32} />
        <h1>Creating your wallet</h1>
        <p>Your recovery secret is being generated and encrypted on this device.</p>
      </div>
      {error && (
        <div className='text-center'>
          <p className='text-danger'>{error}</p>
          <Button variant='primary' onClick={provision}>try again</Button>
        </div>
      )}
    </OnboardingShell>
  )
}

function WalletOnboardingSuccess ({ walletId, returnTo }) {
  const safeReturnTo = typeof returnTo === 'string' && isSafeRedirectPath(returnTo) && returnTo !== '/'
    ? returnTo
    : null

  return (
    <OnboardingShell narrow>
      <div className={styles.success}>
        <CheckCircle className={styles.successIcon} width={48} height={48} />
        <div className={styles.heading}>
          <h1>Your wallet is ready</h1>
          <p>Your wallet is set up and ready to use on SN.</p>
        </div>
        <div className={styles.successActions}>
          <Button as={Link} href={selectedWalletRoute(walletId)}>Go to wallet</Button>
          <Button as={Link} href={safeReturnTo || '/'} variant='link'>
            {safeReturnTo ? 'Continue' : 'Go to homepage'}
          </Button>
        </div>
      </div>
    </OnboardingShell>
  )
}

function OnboardingShell ({ children, narrow = false }) {
  return (
    <WalletShellMain mobileTopBar={false}>
      <div className={classNames(styles.page, narrow && styles.pageNarrow)}>{children}</div>
    </WalletShellMain>
  )
}
