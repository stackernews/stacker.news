import { Form, PasswordInput, SubmitButton } from '@/components/form'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from 'react-bootstrap'
import { object, string } from 'yup'
import { Passphrase } from '@/wallets/client/components'
import { useMe } from '@/components/me'
import { useShowModal } from '@/components/modal'
import { useToast } from '@/components/toast'
import { useDisablePassphraseExport, useWalletEncryptionUpdate, useWalletReset } from '@/wallets/client/hooks/query'
import { useWithKeySync } from '@/wallets/client/hooks/global'
import { useWalletLogger } from '@/wallets/client/hooks/logger'
import { useGenerateRandomKey, useKeySalt, useRemoteKeyHash, useSetKey } from '@/wallets/client/hooks/crypto'
import { deriveKey } from '@/wallets/lib/crypto'
import { useSingleFlight } from '@/wallets/client/hooks/singleFlight'
import styles from '@/styles/wallet.module.css'
import RefreshIcon from '@/svgs/refresh-line.svg'

export function useNeedsPassphraseSetup () {
  const { me } = useMe()
  return !!me?.privates?.showPassphrase
}

function useSavePassphrase () {
  const setKey = useSetKey()
  const salt = useKeySalt()
  const disablePassphraseExport = useDisablePassphraseExport()
  const logger = useWalletLogger()

  return useCallback(async ({ passphrase }) => {
    logger.debug('passphrase entered')
    const { key, hash } = await deriveKey(passphrase, salt)
    await setKey({ key, hash })
    await disablePassphraseExport()
  }, [setKey, disablePassphraseExport, logger])
}

export function useResetPassphrase () {
  const showModal = useShowModal()
  const walletReset = useWalletReset()
  const generateRandomKey = useGenerateRandomKey()
  const setKey = useSetKey()
  const withKeySync = useWithKeySync()
  const toaster = useToast()
  const logger = useWalletLogger()

  const resetPassphrase = useCallback((close) =>
    async () => {
      try {
        logger.debug('passphrase reset')
        const { key: randomKey, hash } = await generateRandomKey()
        await withKeySync(async () => {
          await setKey({ key: randomKey, hash }, { updateServer: false })
          await walletReset({ newKeyHash: hash })
        })
        close()
      } catch (err) {
        logger.debug('failed to reset passphrase: ' + err)
        console.error('failed to reset passphrase:', err)
        toaster.danger('failed to reset passphrase')
      }
    }, [walletReset, generateRandomKey, setKey, withKeySync, toaster, logger])

  return useCallback(async () => {
    showModal(close => (
      <div>
        <h4>Reset passphrase</h4>
        <p className='line-height-md fw-bold mt-3'>
          This will delete all your sending credentials. Your credentials for receiving will not be affected.
        </p>
        <p className='line-height-md'>
          After the reset, you will be issued a new passphrase.
        </p>
        <div className='mt-3 d-flex justify-content-end align-items-center'>
          <Button className='me-3 text-muted nav-link fw-bold' variant='link' onClick={close}>cancel</Button>
          <Button variant='danger' onClick={resetPassphrase(close)}>reset</Button>
        </div>
      </div>
    ))
  }, [showModal, resetPassphrase])
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

function PassphrasePromptContent ({
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

export function usePassphrasePrompt ({ showCancel = false, onCancel, onSuccess } = {}) {
  const savePassphrase = useSavePassphrase()
  const hash = useRemoteKeyHash()
  const salt = useKeySalt()
  const resetPassphrase = useResetPassphrase()

  const onSubmit = useCallback(async ({ passphrase }) => {
    await savePassphrase({ passphrase })
    await onSuccess?.()
  }, [savePassphrase, onSuccess])

  const Prompt = useMemo(() => (
    <PassphrasePromptContent
      hash={hash}
      salt={salt}
      onSubmit={onSubmit}
      onReset={resetPassphrase}
      onCancel={onCancel}
      showCancel={showCancel && !!onCancel}
    />
  ), [hash, salt, onCancel, onSubmit, resetPassphrase, showCancel])

  return Prompt
}

export function usePassphraseSetup () {
  const { me } = useMe()
  const needsPassphraseSetup = useNeedsPassphraseSetup()
  const generateRandomKey = useGenerateRandomKey()
  const updateWalletEncryption = useWalletEncryptionUpdate()
  const toaster = useToast()

  const [candidate, setCandidate] = useState(null)
  const [generationError, setGenerationError] = useState(null)

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
      .then(({ passphrase, key, hash }) => {
        if (cancelled) return
        setCandidate({ passphrase, key, hash })
        setGenerationError(null)
      })
      .catch(err => {
        if (cancelled) return
        console.error('failed to generate passphrase:', err)
        setGenerationError(err)
      })

    return () => {
      cancelled = true
    }
  }, [needsPassphraseSetup, candidate, generationError, generateRandomKey])

  const retryGeneration = useCallback(() => {
    setCandidate(null)
    setGenerationError(null)
  }, [])

  const [savePassphrase, savingPassphrase] = useSingleFlight(async () => {
    if (!candidate) return

    try {
      await updateWalletEncryption({ key: candidate.key, hash: candidate.hash })
    } catch (err) {
      toaster.danger('failed to save passphrase: ' + err.message)
      throw err
    }
  })

  const [regeneratePassphrase, regeneratingPassphrase] = useSingleFlight(async () => {
    try {
      const { passphrase, key, hash } = await generateRandomKey()
      setCandidate({ passphrase, key, hash })
      setGenerationError(null)
    } catch (err) {
      console.error('failed to regenerate passphrase:', err)
      toaster.danger('failed to generate a new passphrase')
    }
  })

  const onSaveSubmit = useCallback((e) => {
    e.preventDefault()
    savePassphrase()
  }, [savePassphrase])

  const SetupPrompt = useMemo(() => (
    <div className={candidate ? undefined : 'text-center'}>
      <h4>Save your passphrase</h4>
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
              value={me?.name ?? ''}
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
                    onClick={regeneratePassphrase}
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
                <Button variant='secondary' onClick={retryGeneration}>try again</Button>
              </div>
            </>
            )
          : (
            <p className='line-height-md text-muted mt-4'>generating passphrase...</p>
            )}
    </div>
  ), [candidate, generationError, me?.name, onSaveSubmit, regeneratePassphrase, regeneratingPassphrase, retryGeneration, savingPassphrase])

  return useMemo(
    () => ({ needsPassphraseSetup, SetupPrompt }),
    [needsPassphraseSetup, SetupPrompt]
  )
}
