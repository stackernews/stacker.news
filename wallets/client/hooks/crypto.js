import { useCallback, useMemo } from 'react'
import { useMe } from '@/components/me'
import { useIndexedDB } from '@/components/use-indexeddb'
import { SET_KEY, useKey, useKeyHash, useWalletsDispatch } from '@/wallets/client/hooks/global'
import { useUpdateKeyHash } from '@/wallets/client/hooks/query'
import { useWalletLogger } from '@/wallets/client/hooks/logger'
import { generateRandomPassphrase, deriveKey, decrypt as _decrypt, encrypt as _encrypt } from '@/wallets/lib/crypto'

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

export function useGenerateRandomKey () {
  const salt = useKeySalt()

  return useCallback(async () => {
    const passphrase = generateRandomPassphrase()
    const { key, hash } = await deriveKey(passphrase, salt)
    return { passphrase, key, hash }
  }, [salt])
}
