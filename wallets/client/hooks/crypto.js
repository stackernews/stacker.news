import { useCallback } from 'react'
import { fromHex, toHex } from '@/lib/hex'
import { useMe } from '@/components/me'
import { useIndexedDB } from '@/components/use-indexeddb'
import { useShowModal } from '@/components/modal'
import { Button } from 'react-bootstrap'
import { Passphrase } from '@/wallets/client/components'
import bip39Words from '@/lib/bip39-words'
import { Form, PasswordInput, SubmitButton } from '@/components/form'
import { object, string } from 'yup'
import { SET_KEY, useKey, useWalletsDispatch } from '@/wallets/client/context'
import { useDisablePassphraseExport, useWalletReset } from '@/wallets/client/hooks'

export class CryptoKeyRequiredError extends Error {
  constructor () {
    super('CryptoKey required')
    this.name = 'CryptoKeyRequiredError'
  }
}

export function useLoadKey () {
  const { get } = useIndexedDB()

  return useCallback(async () => {
    return await get('vault', 'key')
  }, [get])
}

export function useLoadOldKey () {
  const { me } = useMe()
  const oldDbName = me?.id ? `app:storage:${me?.id}:vault` : undefined
  const { get } = useIndexedDB(oldDbName)

  return useCallback(async () => {
    return await get('vault', 'key')
  }, [get])
}

export function useSetKey () {
  const { set } = useIndexedDB()
  const dispatch = useWalletsDispatch()

  return useCallback(async ({ key, hash }) => {
    await set('vault', 'key', { key, hash })
    dispatch({ type: SET_KEY, key })
  }, [set, dispatch])
}

export function useEncryption () {
  const defaultKey = useKey()
  return useCallback(
    (value, { key } = {}) => {
      const k = key ?? defaultKey
      if (!k) throw new CryptoKeyRequiredError()
      return encrypt(k, value)
    }, [defaultKey])
}

export function useDecryption () {
  const key = useKey()
  return useCallback(value => {
    if (!key) throw new CryptoKeyRequiredError()
    return decrypt(key, value)
  }, [key])
}

export function useKeyHash () {
  const { me } = useMe()
  return me?.privates?.vaultKeyHash
}

export function useKeySalt () {
  // TODO(wallet-v2): random salt
  const { me } = useMe()
  return `stacker${me?.id}`
}

export function useShowPassphrase () {
  const { me } = useMe()
  const showModal = useShowModal()

  const onShow = useCallback(() => {
    showModal(
      close => <Passphrase />,
      { replaceModal: true, keepOpen: true }
    )
  }, [showModal])

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
  }, [showModal])

  if (!me || !me.privates?.showPassphrase) {
    return null
  }

  return cb
}

export function useSavePassphrase () {
  const setKey = useSetKey()
  const salt = useKeySalt()
  const disablePassphraseExport = useDisablePassphraseExport()

  return useCallback(async ({ passphrase }) => {
    const { key, hash } = await deriveKey(passphrase, salt)
    setKey({ key, hash })
    await disablePassphraseExport()
  }, [setKey, disablePassphraseExport])
}

export function useResetPassphrase () {
  const showModal = useShowModal()
  const walletReset = useWalletReset()

  const resetPassphrase = useCallback((close) =>
    async () => {
      await walletReset()
      close()
    }, [walletReset])

  return useCallback(async () => {
    showModal(close => (
      <div>
        <h4>Reset passphrase</h4>
        <p className='line-height-md fw-bold mt-3'>
          This will delete all your sending credentials. Your credentials for receiving will not be affected.
        </p>
        <p className='line-height-md'>
          After the reset, you will be issued a new passphrase. Take better care of it this time!
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
  const showModal = useShowModal()
  const savePassphrase = useSavePassphrase()
  const hash = useKeyHash()
  const salt = useKeySalt()
  const showPassphrase = useShowPassphrase()
  const resetPassphrase = useResetPassphrase()

  const onSubmit = useCallback((close) =>
    async ({ passphrase }) => {
      await savePassphrase({ passphrase })
      close()
    }, [savePassphrase])

  return useCallback(() => {
    showModal(close => (
      <div>
        <h4>Wallet decryption</h4>
        <p className='line-height-md mt-3'>
          Your wallets have been encrypted on another device. Enter your passphrase to use your wallets on this device.
        </p>
        <p className='line-height-md'>
          {showPassphrase && 'You can find the button to reveal your passphrase above your wallets on the other device.'}
        </p>
        <p className='line-height-md'>
          Press reset if you lost your passphrase.
        </p>
        <Form
          schema={passphraseSchema({ hash, salt })}
          initial={{ passphrase: '' }}
          onSubmit={onSubmit(close)}
        >
          <PasswordInput
            label='passphrase'
            name='passphrase'
            placeholder=''
            required
            autoFocus
            qr
          />
          <div className='mt-3'>
            <div className='d-flex justify-content-between align-items-center'>
              <Button className='me-auto' variant='danger' onClick={resetPassphrase}>reset</Button>
              <Button className='me-3 text-muted nav-link fw-bold' variant='link' onClick={close}>cancel</Button>
              <SubmitButton variant='primary'>save</SubmitButton>
            </div>
          </div>
        </Form>
      </div>
    ))
  }, [showModal, savePassphrase, hash, salt])
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
  const hash = toHex(await window.crypto.subtle.digest('SHA-256', rawKey))
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

async function encrypt (key, value) {
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
    iv: toHex(iv.buffer),
    value: toHex(encrypted)
  }
}

async function decrypt (key, { iv, value }) {
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromHex(iv)
    },
    key,
    fromHex(value)
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
