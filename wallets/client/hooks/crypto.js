import { useCallback, useMemo, useState } from 'react'
import { useMe } from '@/components/me'
import { useIndexedDB } from '@/components/use-indexeddb'
import { useShowModal } from '@/components/modal'
import { Button } from 'react-bootstrap'
import { Passphrase } from '@/wallets/client/components'
import bip39Words from '@/lib/bip39-words'
import { Form, PasswordInput, SubmitButton } from '@/components/form'
import { object, string } from 'yup'
import { SET_KEY, useKey, useKeyHash, useWalletsDispatch } from '@/wallets/client/context'
import { useDisablePassphraseExport, useUpdateKeyHash, useWalletEncryptionUpdate, useWalletLogger, useWalletReset } from '@/wallets/client/hooks'
import { useToast } from '@/components/toast'

export class CryptoKeyRequiredError extends Error {
  constructor () {
    super('CryptoKey required')
    this.name = 'CryptoKeyRequiredError'
  }
}

export function useDeleteOldDb () {
  const { me } = useMe()
  const oldDbName = me?.id ? `app:storage:${me?.id}:vault` : undefined
  const { deleteDb } = useIndexedDB(oldDbName)

  return useCallback(async () => {
    return await deleteDb()
  }, [deleteDb])
}

export function useSetKey () {
  const { set } = useIndexedDB()
  const dispatch = useWalletsDispatch()
  const updateKeyHash = useUpdateKeyHash()
  const logger = useWalletLogger()

  return useCallback(async ({ key, hash, updatedAt }, { updateDb = true } = {}) => {
    if (updateDb) {
      updatedAt = updatedAt ?? Date.now()
      await set('vault', 'key', { key, hash, updatedAt })
    }
    await updateKeyHash(hash)
    dispatch({ type: SET_KEY, key, hash, updatedAt })
    logger.debug(`using key ${hash}`)
  }, [set, dispatch, updateKeyHash, logger])
}

export function useEncryption () {
  const defaultKey = useKey()
  const defaultKeyHash = useKeyHash()

  const encrypt = useCallback(
    (value, { key, hash } = {}) => {
      const k = key ?? defaultKey
      const h = hash ?? defaultKeyHash
      if (!k || !h) throw new CryptoKeyRequiredError()
      return _encrypt({ key: k, hash: h }, value)
    }, [defaultKey, defaultKeyHash])

  return useMemo(() => ({
    encrypt,
    ready: !!defaultKey
  }), [encrypt, defaultKey])
}

export function useDecryption () {
  const key = useKey()

  const decrypt = useCallback(value => {
    if (!key) throw new CryptoKeyRequiredError()
    return _decrypt(key, value)
  }, [key])

  return useMemo(() => ({
    decrypt,
    ready: !!key
  }), [decrypt, key])
}

export function useRemoteKeyHash () {
  const { me } = useMe()
  return me?.privates?.vaultKeyHash
}

export function useRemoteKeyHashUpdatedAt () {
  const { me } = useMe()
  return me?.privates?.vaultKeyHashUpdatedAt
}

export function useIsWrongKey () {
  const localHash = useKeyHash()
  const remoteHash = useRemoteKeyHash()
  return localHash && remoteHash && localHash !== remoteHash
}

export function useKeySalt () {
  // TODO(wallet-v2): random salt
  const { me } = useMe()
  return `stacker${me?.id}`
}

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

export function useSavePassphrase () {
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
      <p className='line-height-md fw-bold'>
        Press reset if you lost your passphrase.
      </p>
      <Form
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

export async function deriveKey (passphrase, salt) {
  const enc = new TextEncoder()

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      // 600,000 iterations is recommended by OWASP
      // see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2
      iterations: 600_000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )

  const rawKey = await window.crypto.subtle.exportKey('raw', key)
  const hash = Buffer.from(await window.crypto.subtle.digest('SHA-256', rawKey)).toString('hex')
  const unextractableKey = await window.crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )

  return {
    key: unextractableKey,
    hash
  }
}

async function _encrypt ({ key, hash }, value) {
  // random IVs are _really_ important in GCM: reusing the IV once can lead to catastrophic failure
  // see https://crypto.stackexchange.com/questions/26790/how-bad-it-is-using-the-same-iv-twice-with-aes-gcm
  // 12 bytes (96 bits) is the recommended IV size for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(value))
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    encoded
  )
  return {
    keyHash: hash,
    iv: Buffer.from(iv).toString('hex'),
    value: Buffer.from(encrypted).toString('hex')
  }
}

async function _decrypt (key, { iv, value }) {
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: Buffer.from(iv, 'hex')
    },
    key,
    Buffer.from(value, 'hex')
  )
  const decoded = new TextDecoder().decode(decrypted)
  return JSON.parse(decoded)
}

export function useGenerateRandomKey () {
  const salt = useKeySalt()

  return useCallback(async () => {
    const passphrase = generateRandomPassphrase()
    const { key, hash } = await deriveKey(passphrase, salt)
    return { passphrase, key, hash }
  }, [salt])
}

function generateRandomPassphrase () {
  const rand = new Uint32Array(12)
  window.crypto.getRandomValues(rand)
  return Array.from(rand).map(i => bip39Words[i % bip39Words.length]).join(' ')
}
