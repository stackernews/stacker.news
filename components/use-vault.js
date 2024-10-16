import { useCallback, useState, useEffect, useRef } from 'react'
import { useMe } from '@/components/me'
import { useMutation, useApolloClient } from '@apollo/client'
import { SET_ENTRY, UNSET_ENTRY, GET_ENTRY, CLEAR_VAULT, SET_VAULT_KEY_HASH } from '@/fragments/vault'
import { E_VAULT_KEY_EXISTS } from '@/lib/error'
import { useToast } from '@/components/toast'
import useLocalStorage, { openLocalStorage, listLocalStorages } from '@/components/use-local-storage'
import { toHex, fromHex } from '@/lib/hex'
import createTaskQueue from '@/lib/task-queue'

/**
 * A react hook to configure the vault for the current user
 */
export function useVaultConfigurator () {
  const { me } = useMe()
  const toaster = useToast()
  const [setVaultKeyHash] = useMutation(SET_VAULT_KEY_HASH)

  const [vaultKey, innerSetVaultKey] = useState(null)
  const [config, configError] = useConfig()
  const [vaultKeyHash, setVaultKeyHashLocal] = useState(null)

  useEffect(() => {
    if (!me) return
    if (configError) {
      toaster.danger('error loading vault configuration ' + configError.message)
      return
    }
    (async () => {
      let localVaultKey = await config.get('key')
      const keyHash = me?.privates?.vaultKeyHash || vaultKeyHash
      if ((!keyHash && localVaultKey?.hash) || (localVaultKey?.hash !== keyHash)) {
        // If the hash stored in the server does not match the hash of the local key,
        // we can tell that the key is outdated (reset by another device or other reasons)
        // in this case we clear the local key and let the user re-enter the passphrase
        console.log('vault key hash mismatch, clearing local key', localVaultKey?.hash, '!=', keyHash)
        localVaultKey = null
        await config.unset('key')
      }
      innerSetVaultKey(localVaultKey)
    })()
  }, [me?.privates?.vaultKeyHash, config, configError])

  // clear vault: remove everything and reset the key
  const [clearVault] = useMutation(CLEAR_VAULT, {
    onCompleted: async () => {
      await config.unset('key')
      innerSetVaultKey(null)
    }
  })

  // initialize the vault and set a vault key
  const setVaultKey = useCallback(async (passphrase) => {
    const vaultKey = await deriveKey(me.id, passphrase)
    await setVaultKeyHash({
      variables: { hash: vaultKey.hash },
      onError: (error) => {
        const errorCode = error.graphQLErrors[0]?.extensions?.code
        if (errorCode === E_VAULT_KEY_EXISTS) {
          throw new Error('wrong passphrase')
        }
        toaster.danger(error.graphQLErrors[0].message)
      }
    })
    innerSetVaultKey(vaultKey)
    setVaultKeyHashLocal(vaultKey.hash)
    await config.set('key', vaultKey)
  }, [setVaultKeyHash])

  // disconnect the user from the vault (will not clear or reset the passphrase, use clearVault for that)
  const disconnectVault = useCallback(async () => {
    await config.unset('key')
    innerSetVaultKey(null)
  }, [innerSetVaultKey, config])

  return [vaultKey, setVaultKey, clearVault, disconnectVault]
}

/**
 * A react hook to migrate local vault storage to the synched vault
 */
export function useVaultMigration () {
  const { me } = useMe()
  const apollo = useApolloClient()
  // migrate local storage to vault
  const migrate = useCallback(async () => {
    let migratedCount = 0
    const config = await openConfig(me?.id)
    const vaultKey = await config.get('key')
    if (!vaultKey) throw new Error('vault key not found')
    // we collect all the storages used by the vault
    const namespaces = await listLocalStorages({ userId: me?.id, database: 'vault', supportLegacy: true })
    for (const namespace of namespaces) {
      // we open every one of them and copy the entries to the vault
      const storage = await openLocalStorage({ userId: me?.id, database: 'vault', namespace, supportLegacy: true })
      const entryNames = await storage.list()
      for (const entryName of entryNames) {
        try {
          const value = await storage.get(entryName)
          if (!value) throw new Error('no value found in local storage')
          // (we know the layout we use for vault entries)
          const type = namespace[0]
          const id = namespace[1]
          if (!type || !id || isNaN(id)) throw new Error('unknown vault namespace layout')
          // encrypt and store on the server
          const encrypted = await encryptData(vaultKey.key, value)
          const { data } = await apollo.mutate({
            mutation: SET_ENTRY,
            variables: {
              key: entryName,
              value: encrypted,
              skipIfSet: true,
              ownerType: type,
              ownerId: Number(id)
            }
          })
          if (data?.setVaultEntry) {
            // clear local storage
            await storage.unset(entryName)
            migratedCount++
            console.log('migrated to vault:', entryName)
          } else {
            console.log('could not set vault entry:', entryName)
          }
        } catch (e) {
          console.error('failed migrate to vault:', entryName, e)
        }
      }
      await storage.close()
    }
    return migratedCount
  }, [me?.id])

  return migrate
}

export async function unsetLocalKey (userId) {
  const config = await openConfig(userId)
  await config.unset('key')
  await config.close()
}

/**
 * A react hook to use the vault for a specific owner entity and key
 * It will automatically handle the vault lifecycle and value updates
 * @param {*} owner - the owner entity with id and type or __typename (must extend VaultOwner in the graphql schema)
 * @param {*} key - the key to store and retrieve the value
 * @param {*} defaultValue - the default value to return when no value is found
 *
 * @returns {Array} - An array containing:
 * @returns {any} 0 - The current value stored in the vault.
 * @returns {function(any): Promise<void>} 1 - A function to set a new value in the vault.
 * @returns {function({onlyFromLocalStorage?: boolean}): Promise<void>} 2 - A function to clear the value in the vault.
 * @returns {function(): Promise<void>} 3 - A function to refresh the value from the vault.
 */
export default function useVault (owner, key, defaultValue) {
  const { me } = useMe()
  const toaster = useToast()
  const apollo = useApolloClient()

  const [value, innerSetValue] = useState(undefined)
  const vault = useRef(openVault(apollo, me, owner))

  const setValue = useCallback(async (newValue) => {
    innerSetValue(newValue)
    return vault.current.set(key, newValue)
  }, [key])

  const clearValue = useCallback(async ({ onlyFromLocalStorage = false } = {}) => {
    innerSetValue(defaultValue)
    return vault.current.clear(key, { onlyFromLocalStorage })
  }, [key, defaultValue])

  const refreshData = useCallback(async () => {
    innerSetValue(await vault.current.get(key))
  }, [key])

  useEffect(() => {
    const currentVault = vault.current
    const newVault = openVault(apollo, me, owner)
    vault.current = newVault
    if (currentVault)currentVault.close()
    refreshData().catch(e => toaster.danger('failed to refresh vault data: ' + e.message))
    return () => {
      newVault.close()
    }
  }, [me, owner, key])

  return [value, setValue, clearValue, refreshData]
}

/**
 * Open the vault for the given user and owner entry
 * @param {*} apollo - the apollo client
 * @param {*} user - the user entry with id and privates.vaultKeyHash
 * @param {*} owner - the owner entry with id and type or __typename (must extend VaultOwner in the graphql schema)
 *
 * @returns {Object} - An object containing:
 * @returns {function(string, any): Promise<any>} get - A function to get a value from the vault.
 * @returns {function(string, any): Promise<void>} set - A function to set a new value in the vault.
 * @returns {function(string, {onlyFromLocalStorage?: boolean}): Promise<void>} clear - A function to clear a value in the vault.
 * @returns {function(): Promise<void>} refresh - A function to refresh the value from the vault.
 */
export function openVault (apollo, user, owner) {
  const userId = user?.id
  const type = owner?.__typename || owner?.type
  const id = owner?.id

  const localOnly = !userId

  let config = null
  let localStore = null
  const queue = createTaskQueue()

  const waitInitialization = async () => {
    if (!config) {
      config = await openConfig(userId)
    }
    if (!localStore) {
      localStore = type && id ? await openLocalStorage({ userId, database: localOnly ? 'local-vault' : 'vault', namespace: [type, id] }) : null
    }
  }

  const getValue = async (key, defaultValue) => {
    return await queue.enqueue(async () => {
      await waitInitialization()
      if (!localStore) return undefined

      if (localOnly) {
      // local only: we fetch from local storage and return
        return ((await localStore.get(key)) || defaultValue)
      }

      const localVaultKey = await config.get('key')
      if (!localVaultKey?.hash) {
        // no vault key set: use local storage
        return ((await localStore.get(key)) || defaultValue)
      }

      if ((!user.privates.vaultKeyHash && localVaultKey?.hash) || (localVaultKey?.hash !== user.privates.vaultKeyHash)) {
      // no or different vault setup on server: use unencrypted local storage
      // and clear local key if it exists
        console.log('Vault key hash mismatch, clearing local key', localVaultKey?.hash, user.privates.vaultKeyHash)
        await config.unset('key')
        return ((await localStore.get(key)) || defaultValue)
      }

      // if vault key hash is set on the server and matches our local key, we try to fetch from the vault
      {
        const { data: queriedData, error: queriedError } = await apollo.query({
          query: GET_ENTRY,
          variables: { key, ownerId: id, ownerType: type },
          nextFetchPolicy: 'no-cache',
          fetchPolicy: 'no-cache'
        })
        if (queriedError) throw queriedError
        const encryptedVaultValue = queriedData?.getVaultEntry?.value
        if (encryptedVaultValue) {
          try {
            const vaultValue = await decryptData(localVaultKey.key, encryptedVaultValue)
            // console.log('decrypted value from vault:', storageKey, encrypted, decrypted)
            // remove local storage value if it exists
            await localStore.unset(key)
            return vaultValue
          } catch (e) {
            console.error('cannot read vault data:', key, e)
          }
        }
      }

      // fallback to local storage
      return ((await localStore.get(key)) || defaultValue)
    })
  }

  const setValue = async (key, newValue) => {
    return await queue.enqueue(async () => {
      await waitInitialization()

      if (!localStore) {
        return
      }
      const vaultKey = await config.get('key')

      const useVault = vaultKey && vaultKey.hash === user.privates.vaultKeyHash

      if (useVault && !localOnly) {
        const encryptedValue = await encryptData(vaultKey.key, newValue)
        console.log('store encrypted value in vault:', key)
        await apollo.mutate({
          mutation: SET_ENTRY,
          variables: { key, value: encryptedValue, ownerId: id, ownerType: type }
        })
        // clear local storage (we get rid of stored unencrypted data as soon as it can be stored on the vault)
        await localStore.unset(key)
      } else {
        console.log('store value in local storage:', key)
        // otherwise use local storage
        await localStore.set(key, newValue)
      }
    })
  }

  const clearValue = async (key, { onlyFromLocalStorage } = {}) => {
    return await queue.enqueue(async () => {
      await waitInitialization()
      if (!localStore) return

      const vaultKey = await config.get('key')
      const useVault = vaultKey && vaultKey.hash === user.privates.vaultKeyHash

      if (!localOnly && useVault && !onlyFromLocalStorage) {
        await apollo.mutate({
          mutation: UNSET_ENTRY,
          variables: { key, ownerId: id, ownerType: type }
        })
      }
      // clear local storage
      await localStore.unset(key)
    })
  }

  const close = async () => {
    return await queue.enqueue(async () => {
      await config?.close()
      await localStore?.close()
      config = null
      localStore = null
    })
  }

  return { get: getValue, set: setValue, clear: clearValue, close }
}

function useConfig () {
  return useLocalStorage({ database: 'vault-config', namespace: ['settings'], supportLegacy: false })
}

async function openConfig (userId) {
  return await openLocalStorage({ userId, database: 'vault-config', namespace: ['settings'] })
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

/**
 * Encrypt data using AES-GCM
 * @param {CryptoKey} sharedKey - the key to use for encryption
 * @param {Object} data - the data to encrypt
 * @returns {Promise<string>} a string representing the encrypted data, can be passed to decryptData to get the original data back
 */
async function encryptData (sharedKey, data) {
  // random IVs are _really_ important in GCM: reusing the IV once can lead to catastrophic failure
  // see https://crypto.stackexchange.com/questions/26790/how-bad-it-is-using-the-same-iv-twice-with-aes-gcm
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(data))
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    sharedKey,
    encoded
  )
  return JSON.stringify({
    iv: toHex(iv.buffer),
    data: toHex(encrypted)
  })
}

/**
 * Decrypt data using AES-GCM
 * @param {CryptoKey} sharedKey - the key to use for decryption
 * @param {string} encryptedData - the encrypted data as returned by encryptData
 * @returns {Promise<Object>} the original unencrypted data
 */
async function decryptData (sharedKey, encryptedData) {
  const { iv, data } = JSON.parse(encryptedData)
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromHex(iv)
    },
    sharedKey,
    fromHex(data)
  )
  const decoded = new TextDecoder().decode(decrypted)
  return JSON.parse(decoded)
}
