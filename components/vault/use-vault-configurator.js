import { useMutation, useQuery } from '@apollo/client'
import { useMe } from '../me'
import { useToast } from '../toast'
import useIndexedDB, { getDbName } from '../use-indexeddb'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { E_VAULT_KEY_EXISTS } from '@/lib/error'
import { CLEAR_VAULT, GET_VAULT_ENTRIES, UPDATE_VAULT_KEY } from '@/fragments/vault'
import { toHex } from '@/lib/hex'
import { decryptValue, encryptValue } from './use-vault'

const useImperativeQuery = (query) => {
  const { refetch } = useQuery(query, { skip: true })

  const imperativelyCallQuery = (variables) => {
    return refetch(variables)
  }

  return imperativelyCallQuery
}

export function useVaultConfigurator () {
  const { me } = useMe()
  const toaster = useToast()
  const idbConfig = useMemo(() => ({ dbName: getDbName(me?.id, 'vault'), storeName: 'vault', options: {} }), [me?.id])
  const { set, get, remove } = useIndexedDB(idbConfig)
  const [updateVaultKey] = useMutation(UPDATE_VAULT_KEY)
  const getVaultEntries = useImperativeQuery(GET_VAULT_ENTRIES)
  const [key, setKey] = useState(null)
  const [keyHash, setKeyHash] = useState(null)

  useEffect(() => {
    if (!me) return
    (async () => {
      try {
        let localVaultKey = await get('key')
        const localKeyHash = me?.privates?.vaultKeyHash || keyHash
        if (localVaultKey?.hash && localVaultKey?.hash !== localKeyHash) {
          // If the hash stored in the server does not match the hash of the local key,
          // we can tell that the key is outdated (reset by another device or other reasons)
          // in this case we clear the local key and let the user re-enter the passphrase
          console.log('vault key hash mismatch, clearing local key', localVaultKey?.hash, '!=', localKeyHash)
          localVaultKey = null
          await remove('key')
        }
        setKey(localVaultKey)
      } catch (e) {
        // toaster?.danger('error loading vault configuration ' + e.message)
      }
    })()
  }, [me?.privates?.vaultKeyHash, keyHash, get, remove, setKey])

  // clear vault: remove everything and reset the key
  const [clearVault] = useMutation(CLEAR_VAULT, {
    onCompleted: async () => {
      try {
        await remove('key')
        setKey(null)
        setKeyHash(null)
      } catch (e) {
        toaster.danger('error clearing vault ' + e.message)
      }
    }
  })

  const disconnectVault = useCallback(async () => {
    await remove('key')
    setKey(null)
    setKeyHash(null)
  }, [remove, setKey, setKeyHash])

  // initialize the vault and set a vault key
  const setVaultKey = useCallback(async (passphrase) => {
    try {
      const oldKeyValue = await get('key')
      const vaultKey = await deriveKey(me.id, passphrase)
      const { data } = await getVaultEntries()

      // TODO: push any local configurations to the server so long as they don't conflict
      // delete any locally stored configurations after vault key is set
      const entries = []
      for (const { key, iv, value } of data.getVaultEntries) {
        const plainValue = await decryptValue(oldKeyValue.key, { iv, value })
        entries.push({ key, ...await encryptValue(vaultKey.key, plainValue) })
      }

      await updateVaultKey({
        variables: { entries, hash: vaultKey.hash },
        onError: (error) => {
          const errorCode = error.graphQLErrors[0]?.extensions?.code
          if (errorCode === E_VAULT_KEY_EXISTS) {
            throw new Error('wrong passphrase')
          }
          toaster.danger(error.graphQLErrors[0].message)
        }
      })
      setKey(vaultKey)
      setKeyHash(vaultKey.hash)
      await set('key', vaultKey)
    } catch (e) {
      toaster.danger(e.message)
    }
  }, [getVaultEntries, updateVaultKey, set, get, remove])

  return { key, setVaultKey, clearVault, disconnectVault }
}

/**
 * Derive a key to be used for the vault encryption
 * @param {string | number} userId - the id of the user (used for salting)
 * @param {string} passphrase - the passphrase to derive the key from
 * @returns {Promise<{key: CryptoKey, hash: string, extractable: boolean}>} an un-extractable CryptoKey and its hash
 */
async function deriveKey (userId, passphrase) {
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
      salt: enc.encode(`stacker${userId}`),
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
