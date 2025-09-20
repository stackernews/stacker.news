import { useCallback, useMemo } from 'react'
import { fromHex, toHex } from '@/lib/hex'
import { useMe } from '@/components/me'
import { useIndexedDB } from '@/components/use-indexeddb'
import { SET_KEY, useKey, useKeyHash, useWalletsDispatch } from '@/wallets/client/context'
import { useUpdateKeyHash, useWalletLogger } from '@/wallets/client/hooks'
import { generateRandomPassphrase } from '@/wallets/client/hooks/passphrase'

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
    iv: toHex(iv.buffer),
    value: toHex(encrypted)
  }
}

async function _decrypt (key, { iv, value }) {
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
