import { useCallback, useMemo } from 'react'
import { useMe } from '@/components/me'
import { useIndexedDB } from '@/components/use-indexeddb'
import { SET_KEY, useKey, useKeyHash, useWalletsDispatch } from '@/wallets/client/hooks/global'
import { useUpdateKeyHash } from '@/wallets/client/hooks/query'
import { useWalletLogger } from '@/wallets/client/hooks/logger'
import { decrypt as _decrypt, deriveKey, encrypt as _encrypt, generateRandomPassphrase } from '@/wallets/lib/crypto'

export class CryptoKeyRequiredError extends Error {
  constructor () {
    super('CryptoKey required')
    this.name = 'CryptoKeyRequiredError'
  }
}

export class WalletLocalStateRecoveryError extends Error {
  constructor (message = 'failed to recover local wallet state on this device') {
    super(message)
    this.name = 'WalletLocalStateRecoveryError'
  }
}

const VAULT_STORE_NAME = 'vault'
const VAULT_KEY_ID = 'key'

export async function readOrCreateVaultKeyRecord (db, { createKey, logger }) {
  // IndexedDB transactions auto-commit around async gaps, so the key must be
  // prepared before opening the read/write transaction that may need to store it.
  const { key, hash } = await createKey()

  return await new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE_NAME, 'readwrite')
    const read = tx.objectStore(VAULT_STORE_NAME).get(VAULT_KEY_ID)

    read.onerror = () => {
      logger?.debug?.('vault init: error reading key: ' + read.error)
      reject(read.error)
    }

    read.onsuccess = () => {
      if (read.result) {
        logger?.debug?.('vault init: key found in IndexedDB')
        return resolve(read.result)
      }

      const record = buildVaultKeyRecord({ key, hash })
      const write = tx.objectStore(VAULT_STORE_NAME).put(record, VAULT_KEY_ID)

      write.onerror = () => {
        logger?.debug?.('vault init: error writing new random key: ' + write.error)
        reject(write.error)
      }

      write.onsuccess = () => {
        logger?.debug?.('vault init: saved new random key')
        resolve(record)
      }
    }
  })
}

export function useVaultLocalStore () {
  const { get, open, remove, set } = useIndexedDB()

  const readKey = useCallback(async () => {
    return await get(VAULT_STORE_NAME, VAULT_KEY_ID)
  }, [get])

  const writeKey = useCallback(async ({ key, hash, updatedAt }) => {
    return await writeVaultKeyRecord(set, { key, hash, updatedAt })
  }, [set])

  const deleteKey = useCallback(async () => {
    await remove(VAULT_STORE_NAME, VAULT_KEY_ID)
  }, [remove])

  return useMemo(() => ({
    open,
    readKey,
    deleteKey,
    writeKey
  }), [open, readKey, deleteKey, writeKey])
}

export function useSetKey () {
  const { writeKey } = useVaultLocalStore()
  const dispatch = useWalletsDispatch()
  const updateKeyHash = useUpdateKeyHash()
  const logger = useWalletLogger()

  return useCallback(async ({ key, hash, updatedAt }, { updateDb = true, updateServer = true } = {}) => {
    if (updateDb) {
      const record = await writeKey({ key, hash, updatedAt })
      updatedAt = record.updatedAt
    }
    if (updateServer) {
      await updateKeyHash(hash)
    }
    dispatch({ type: SET_KEY, key, hash, updatedAt })
    logger.debug(`using key ${hash}`)
  }, [writeKey, dispatch, updateKeyHash, logger])
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

export function useIsWrongKey () {
  const localHash = useKeyHash()
  const { me } = useMe()
  const remoteHash = me?.privates?.vaultKeyHash ?? null
  return isWrongVaultKey(localHash, remoteHash)
}

export function useKeySalt () {
  // TODO(wallet-v2): random salt
  const { me } = useMe()
  return `stacker${me?.id}`
}

export function useGenerateRandomKey () {
  const salt = useKeySalt()

  return useCallback(async () => {
    return await generateRandomVaultKey(salt)
  }, [salt])
}

export async function stageVaultKeyWithRollback ({
  readKey,
  writeKey,
  deleteKey,
  key,
  hash,
  runServerChange
}) {
  const previousRecord = await readKey()
  const nextRecord = await writeKey({ key, hash })

  try {
    await runServerChange()
    return nextRecord
  } catch (err) {
    if (previousRecord) {
      try {
        await writeKey(previousRecord)
      } catch (rollbackError) {
        console.error('failed to rollback staged vault key:', rollbackError)
        await clearStagedVaultKeyOrThrow(deleteKey, rollbackError)
      }
    } else {
      try {
        await deleteKey()
      } catch (rollbackError) {
        console.error('failed to clear staged vault key:', rollbackError)
        throw new WalletLocalStateRecoveryError()
      }
    }

    throw err
  }
}

function isWrongVaultKey (localHash, remoteHash) {
  return Boolean(localHash && remoteHash && localHash !== remoteHash)
}

async function generateRandomVaultKey (salt) {
  const passphrase = generateRandomPassphrase()
  const { key, hash } = await deriveKey(passphrase, salt)

  return { passphrase, key, hash }
}

async function writeVaultKeyRecord (write, { key, hash, updatedAt }) {
  const record = buildVaultKeyRecord({ key, hash, updatedAt })
  await write(VAULT_STORE_NAME, VAULT_KEY_ID, record)
  return record
}

async function clearStagedVaultKeyOrThrow (deleteKey, rollbackError) {
  try {
    await deleteKey()
  } catch (clearError) {
    console.error('failed to clear staged vault key after rollback failure:', clearError)
    throw new WalletLocalStateRecoveryError()
  }

  console.error('cleared staged vault key after rollback failure:', rollbackError)
  throw new WalletLocalStateRecoveryError()
}

function buildVaultKeyRecord ({ key, hash, updatedAt = Date.now() }) {
  return { key, hash, updatedAt }
}
