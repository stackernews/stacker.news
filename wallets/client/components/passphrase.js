import React, { useCallback, useEffect, useState } from 'react'
import { CopyButton, Form, PasswordInput, SubmitButton } from '@/components/form'
import { Button } from 'react-bootstrap'
import { object, string } from 'yup'
import { useMe } from '@/components/me'
import { useShowModal } from '@/components/modal'
import { useToast } from '@/components/toast'
import { useGenerateRandomKey, useKeySalt, useSetKey } from '@/wallets/client/hooks/crypto'
import { deriveKey } from '@/wallets/lib/crypto'
import { useSingleFlight } from '@/wallets/client/hooks/singleFlight'
import { useWalletLogger } from '@/wallets/client/hooks/payment'
import { useWithKeySync } from '@/wallets/client/hooks/global'
import { useDisablePassphraseExport, useWalletEncryptionUpdate, useWalletReset } from '@/wallets/client/hooks/query'
import styles from '@/styles/wallet.module.css'
import RefreshIcon from '@/svgs/refresh-line.svg'

function Passphrase ({
  passphrase,
  title = 'Readable backup',
  hint = 'Use this word list to quickly verify or write down the phrase.',
  showCopyButton = true
}) {
  const words = passphrase.trim().split(/\s+/)
  return (
    <div className={styles.passphraseSection}>
      <div className='d-flex justify-content-between align-items-start gap-3'>
        <div>
          <div className={styles.passphraseSectionTitle}>{title}</div>
          {hint && (
            <p className='text-muted mb-0 line-height-md'>
              {hint}
            </p>
          )}
        </div>
        {showCopyButton && (
          <CopyButton className='rounded flex-shrink-0' value={passphrase} variant='grey-medium' />
        )}
      </div>
      <div className={styles.passphrase}>
        {words.map((word, index) => (
          <div className='d-flex' key={index}>
            <span className='text-muted me-2'>{index + 1}.</span>
            <wbr />
            <span className='font-monospace text-break'>{word}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const passphraseSchema = ({ hash, salt }) => object().shape({
  passphrase: string().required('required')
    .test(async (value, context) => {
      const { hash: expectedHash } = await deriveKey(value, salt)
      if (hash !== expectedHash) {
        return context.createError({ message: 'wrong passphrase' })
      }
      return true
    })
})

function useVaultActions () {
  const setKey = useSetKey()
  const keySalt = useKeySalt()
  const disablePassphraseExport = useDisablePassphraseExport()
  const generateRandomKey = useGenerateRandomKey()
  const updateWalletEncryption = useWalletEncryptionUpdate()
  const walletReset = useWalletReset()
  const withKeySync = useWithKeySync()
  const logger = useWalletLogger()

  const unlockWithPassphrase = useCallback(async ({ passphrase }) => {
    logger.debug('vault unlock requested')
    const { key, hash } = await deriveKey(passphrase, keySalt)
    await setKey({ key, hash }, { updateServer: false })
    await disablePassphraseExport()
    logger.debug('vault unlock completed')
  }, [setKey, disablePassphraseExport, keySalt, logger])

  const savePassphraseCandidate = useCallback(async ({ key, hash }) => {
    logger.debug('vault passphrase save requested')
    await updateWalletEncryption({ key, hash })
    logger.debug('vault passphrase save completed')
  }, [updateWalletEncryption, logger])

  const resetPassphrase = useCallback(async () => {
    logger.debug('vault passphrase reset requested')
    const { key: randomKey, hash } = await generateRandomKey()

    await withKeySync(async () => {
      await setKey({ key: randomKey, hash }, { updateServer: false })
      await walletReset({ newKeyHash: hash })
    })

    logger.debug('vault passphrase reset completed')
  }, [generateRandomKey, setKey, walletReset, withKeySync, logger])

  return {
    unlockWithPassphrase,
    savePassphraseCandidate,
    resetPassphrase
  }
}

function ResetPassphraseDialog ({ onCancel, onConfirm }) {
  return (
    <div>
      <h4>Reset Stacker News wallet passphrase</h4>
      <p className='line-height-md fw-bold mt-3'>
        This will delete all your sending wallet configurations. Your account will not be affected otherwise.
      </p>
      <p className='line-height-md'>
        After the reset, you will be issued a new Stacker News wallet passphrase.
      </p>
      <div className='mt-3 d-flex justify-content-end align-items-center'>
        <Button className='me-3 text-muted nav-link fw-bold' variant='link' onClick={onCancel}>cancel</Button>
        <Button variant='danger' onClick={onConfirm}>reset</Button>
      </div>
    </div>
  )
}

export function WalletPassphrasePrompt ({
  showCancel = false,
  onCancel,
  onSuccess
}) {
  const { me } = useMe()
  const { resetPassphrase, unlockWithPassphrase } = useVaultActions()
  const hash = me?.privates?.vaultKeyHash ?? null
  const salt = useKeySalt()
  const showModal = useShowModal()
  const toaster = useToast()

  const onSubmit = useCallback(async ({ passphrase }) => {
    await unlockWithPassphrase({ passphrase })
    await onSuccess?.()
  }, [unlockWithPassphrase, onSuccess])

  const showResetPassphraseModal = useCallback(() => {
    showModal(close => (
      <ResetPassphraseDialog
        onCancel={close}
        onConfirm={async () => {
          try {
            await resetPassphrase()
            close()
          } catch (err) {
            console.error('failed to reset passphrase:', err)
            toaster.danger('failed to reset passphrase')
          }
        }}
      />
    ))
  }, [showModal, resetPassphrase, toaster])

  return (
    <WalletPassphrasePromptContent
      hash={hash}
      salt={salt}
      onSubmit={onSubmit}
      onReset={showResetPassphraseModal}
      onCancel={onCancel}
      showCancel={showCancel && !!onCancel}
    />
  )
}

function WalletPassphrasePromptContent ({
  hash,
  salt,
  onSubmit,
  onReset,
  onCancel,
  showCancel = true
}) {
  return (
    <div>
      <h4>Enter your Stacker News wallet passphrase</h4>
      <p className='line-height-md mt-3'>
        Enter the passphrase you saved when you first set up wallets on another device.
      </p>
      <Form
        className='mt-4'
        schema={passphraseSchema({ hash, salt })}
        initial={{ passphrase: '' }}
        onSubmit={onSubmit}
      >
        <div className={styles.passphraseSetup}>
          <div className={styles.passphraseSetupNotice}>
            <p className='fw-bold mb-2 line-height-md'>
              Enter your Stacker News wallet passphrase to access your wallets on this device.
            </p>
            <p className='text-muted mb-0 line-height-md'>
              If you stored it in your password manager, it may be available to fill below.
            </p>
          </div>

          <PasswordInput
            label='Enter your saved passphrase'
            name='passphrase'
            placeholder=''
            under={(
              <div className={styles.passphraseInputHint}>
                Use the same passphrase on every device where you want to access these wallets.
              </div>
            )}
            required
            autoFocus
            groupClassName='mb-0'
            className={styles.passphraseManagerInput}
          />

          <div className={styles.passphraseSetupActions}>
            <p className='text-muted mb-0 line-height-md'>
              If you no longer have the saved passphrase, you can reset wallets instead.
            </p>
            <div className={styles.passphraseSetupButtons}>
              <button
                type='button'
                className={styles.passphraseResetButton}
                onClick={onReset}
              >
                reset wallets
              </button>
              <div className='d-flex align-items-center gap-3 flex-wrap justify-content-end'>
                {showCancel && (
                  <Button type='button' className='text-muted nav-link fw-bold p-0' variant='link' onClick={onCancel}>cancel</Button>
                )}
                <SubmitButton variant='primary' submittingText='unlocking...'>unlock</SubmitButton>
              </div>
            </div>
          </div>
        </div>
      </Form>
    </div>
  )
}

function usePassphraseSetupState () {
  const { me } = useMe()
  const needsPassphraseSetup = !!me?.privates?.showPassphrase
  const generateRandomKey = useGenerateRandomKey()
  const { savePassphraseCandidate } = useVaultActions()
  const toaster = useToast()

  const [candidate, setCandidate] = useState(null)
  const [generationError, setGenerationError] = useState(null)

  const applyCandidate = useCallback((nextCandidate) => {
    setCandidate(nextCandidate)
    setGenerationError(null)
  }, [])

  const handleGenerationError = useCallback((err, { toastMessage } = {}) => {
    console.error('failed to generate passphrase:', err)
    setGenerationError(err)
    if (toastMessage) {
      toaster.danger(toastMessage)
    }
  }, [toaster])

  useEffect(() => {
    if (!needsPassphraseSetup) {
      setCandidate(null)
      setGenerationError(null)
    }
  }, [needsPassphraseSetup])

  useEffect(() => {
    if (!needsPassphraseSetup || candidate || generationError) return

    let cancelled = false

    generateRandomKey()
      .then(nextCandidate => {
        if (cancelled) return
        applyCandidate(nextCandidate)
      })
      .catch(err => {
        if (cancelled) return
        handleGenerationError(err)
      })

    return () => {
      cancelled = true
    }
  }, [needsPassphraseSetup, candidate, generationError, generateRandomKey, applyCandidate, handleGenerationError])

  const retryGeneration = useCallback(() => {
    setCandidate(null)
    setGenerationError(null)
  }, [])

  const [savePassphrase, savingPassphrase] = useSingleFlight(async () => {
    if (!candidate) return

    try {
      await savePassphraseCandidate({ key: candidate.key, hash: candidate.hash })
    } catch (err) {
      toaster.danger('failed to save passphrase: ' + err.message)
      throw err
    }
  })

  const [regeneratePassphrase, regeneratingPassphrase] = useSingleFlight(async () => {
    try {
      applyCandidate(await generateRandomKey())
    } catch (err) {
      handleGenerationError(err, { toastMessage: 'failed to generate a new passphrase' })
    }
  })

  const onSaveSubmit = useCallback(async (e) => {
    e.preventDefault()
    try {
      await savePassphrase()
    } catch {}
  }, [savePassphrase])

  return {
    candidate,
    generationError,
    onRegenerate: regeneratePassphrase,
    onRetry: retryGeneration,
    onSaveSubmit,
    regeneratingPassphrase,
    savingPassphrase
  }
}

export function WalletPassphraseSetup () {
  const { me } = useMe()
  const state = usePassphraseSetupState()

  return (
    <WalletPassphraseSetupContent
      username={me?.name}
      {...state}
    />
  )
}

function WalletPassphraseSetupContent ({
  username,
  candidate,
  generationError,
  onRegenerate,
  onRetry,
  onSaveSubmit,
  regeneratingPassphrase,
  savingPassphrase
}) {
  return (
    <div className={candidate ? undefined : 'text-center'}>
      <h4>Save your Stacker News wallet passphrase</h4>
      <p className='line-height-md mt-3'>
        Before you can continue, save this passphrase somewhere safe.
      </p>
      {candidate
        ? (
          <form autoComplete='on' className='mt-4' onSubmit={onSaveSubmit}>
            <input
              type='hidden'
              name='username'
              autoComplete='username'
              value={username ?? ''}
              readOnly
            />
            <div className={styles.passphraseSetup}>
              <div className={styles.passphraseSetupNotice}>
                <p className='fw-bold mb-2 line-height-md'>
                  Save this passphrase before you continue.
                </p>
                <p className='text-muted mb-0 line-height-md'>
                  A password manager is usually the easiest place to keep it.
                </p>
              </div>
              <PasswordInput
                noForm
                id='wallet-passphrase'
                name='passphrase'
                label='Save somewhere safe'
                under={(
                  <div className={styles.passphraseInputHint}>
                    Your browser or password manager may offer to save this field when you continue. You can also use the copy button below.
                  </div>
                )}
                newPass
                readOnly
                value={candidate.passphrase}
                groupClassName='mb-0'
                className={styles.passphraseManagerInput}
              />
              <Passphrase
                passphrase={candidate.passphrase}
                title='Readable backup'
                hint='Use the same passphrase on every device where you want to decrypt your wallets.'
              />
              <div className={styles.passphraseSetupActions}>
                <p className='text-muted mb-0 line-height-md'>
                  After you continue, we will stop showing this passphrase and open your wallets.
                </p>
                <div className={styles.passphraseSetupButtons}>
                  <button
                    type='button'
                    className={styles.passphraseRegenerateButton}
                    onClick={onRegenerate}
                    disabled={savingPassphrase || regeneratingPassphrase}
                    aria-label='generate a new passphrase'
                    title='generate a new passphrase'
                  >
                    <RefreshIcon width={18} height={18} className={regeneratingPassphrase ? 'spin' : undefined} />
                  </button>
                  <Button
                    type='submit'
                    variant='primary'
                    disabled={savingPassphrase || regeneratingPassphrase}
                  >
                    {savingPassphrase ? 'Saving your passphrase...' : "I've saved my passphrase"}
                  </Button>
                </div>
              </div>
            </div>
          </form>
          )
        : generationError
          ? (
            <>
              <p className='line-height-md text-muted mt-4'>
                We could not generate a passphrase right now.
              </p>
              <div className='d-flex justify-content-end mt-3'>
                <Button variant='secondary' onClick={onRetry}>try again</Button>
              </div>
            </>
            )
          : (
            <p className='line-height-md text-muted mt-4'>generating passphrase...</p>
            )}
    </div>
  )
}
