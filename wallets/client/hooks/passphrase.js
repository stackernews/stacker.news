import { Form, PasswordInput, SubmitButton } from '@/components/form'
import { useCallback, useMemo, useState } from 'react'
import { Button } from 'react-bootstrap'
import { object, string } from 'yup'
import { Passphrase } from '@/wallets/client/components'
import { useMe } from '@/components/me'
import { useShowModal } from '@/components/modal'
import { useToast } from '@/components/toast'
import { useDisablePassphraseExport, useWalletEncryptionUpdate, useWalletReset } from '@/wallets/client/hooks/query'
import { useWalletLogger } from '@/wallets/client/hooks/logger'
import { useGenerateRandomKey, useKeySalt, useRemoteKeyHash, useSetKey } from '@/wallets/client/hooks/crypto'
import { deriveKey } from '@/wallets/lib/crypto'
import AccordianItem from '@/components/accordian-item'

export function useShowPassphrase () {
  const { me } = useMe()
  const showModal = useShowModal()
  const generateRandomKey = useGenerateRandomKey()
  const updateWalletEncryption = useWalletEncryptionUpdate()
  const toaster = useToast()

  const onShow = useCallback(async () => {
    let passphrase, key, hash
    try {
      ({ passphrase, key, hash } = await generateRandomKey())
      await updateWalletEncryption({ key, hash })
    } catch (err) {
      toaster.danger('failed to update wallet encryption: ' + err.message)
      return
    }
    showModal(
      close => <Passphrase passphrase={passphrase} />,
      { replaceModal: true, keepOpen: true }
    )
  }, [showModal, generateRandomKey, updateWalletEncryption, toaster])

  const cb = useCallback(() => {
    showModal(close => (
      <div>
        <p className='line-height-md'>
          The next screen will show the passphrase that was used to encrypt your wallets.
        </p>
        <p className='line-height-md fw-bold'>
          You will not be able to see the passphrase again.
        </p>
        <p className='line-height-md'>
          Do you want to see it now?
        </p>
        <div className='mt-3 d-flex justify-content-between align-items-center'>
          <Button variant='grey-medium' onClick={close}>cancel</Button>
          <Button variant='danger' onClick={onShow}>yes, show me</Button>
        </div>
      </div>
    ))
  }, [showModal, onShow])

  if (!me || !me.privates?.showPassphrase) {
    return null
  }

  return cb
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
  const toaster = useToast()
  const logger = useWalletLogger()

  const resetPassphrase = useCallback((close) =>
    async () => {
      try {
        logger.debug('passphrase reset')
        const { key: randomKey, hash } = await generateRandomKey()
        await setKey({ key: randomKey, hash })
        await walletReset({ newKeyHash: hash })
        close()
      } catch (err) {
        logger.debug('failed to reset passphrase: ' + err)
        console.error('failed to reset passphrase:', err)
        toaster.error('failed to reset passphrase')
      }
    }, [walletReset, generateRandomKey, setKey, toaster, logger])

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

export function usePassphrasePrompt () {
  const savePassphrase = useSavePassphrase()
  const hash = useRemoteKeyHash()
  const salt = useKeySalt()
  const showPassphrase = useShowPassphrase()
  const resetPassphrase = useResetPassphrase()

  const onSubmit = useCallback(async ({ passphrase }) => {
    await savePassphrase({ passphrase })
  }, [savePassphrase])

  const [showPassphrasePrompt, setShowPassphrasePrompt] = useState(false)
  const togglePassphrasePrompt = useCallback(() => setShowPassphrasePrompt(v => !v), [])

  const Prompt = useMemo(() => (
    <div>
      <h4>Wallet decryption</h4>
      <p className='line-height-md mt-3'>
        Enter your passphrase to decrypt your wallets on this device.
      </p>
      <p className='line-height-md'>
        {showPassphrase && 'The passphrase reveal button is above your wallets on the original device.'}
      </p>
      <AccordianItem
        className='line-height-md text-white my-3'
        header='I lost my passphrase. What should I do?'
        body={
          <>
            <p>
              If you lost your passphrase, press <span className='fw-bold text-danger'>reset</span>.
              This will <b>issue a new passphrase</b> and <b>delete all your sending credentials</b>.
              Your credentials for receiving will not be affected.
            </p>
          </>
          }
      />
      <Form
        className='mt-3'
        schema={passphraseSchema({ hash, salt })}
        initial={{ passphrase: '' }}
        onSubmit={onSubmit}
      >
        <PasswordInput
          label='passphrase'
          name='passphrase'
          placeholder=''
          required
          autoFocus
        />
        <div className='mt-3'>
          <div className='d-flex justify-content-between align-items-center'>
            <Button className='me-auto' variant='danger' onClick={resetPassphrase}>reset</Button>
            <Button className='me-3 text-muted nav-link fw-bold' variant='link' onClick={togglePassphrasePrompt}>cancel</Button>
            <SubmitButton variant='primary'>save</SubmitButton>
          </div>
        </div>
      </Form>
    </div>
  ), [showPassphrase, resetPassphrase, togglePassphrasePrompt, onSubmit, hash, salt])

  return useMemo(
    () => [showPassphrasePrompt, togglePassphrasePrompt, Prompt],
    [showPassphrasePrompt, togglePassphrasePrompt, Prompt]
  )
}
