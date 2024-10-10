import { useCallback, useState, useEffect } from 'react'
import { useMe } from '@/components/me'
import { useMutation, useApolloClient } from '@apollo/client'
import { SET_ENTRY, UNSET_ENTRY, GET_ENTRY, CLEAR_VAULT, SET_VAULT_KEY_HASH } from '@/fragments/vault'
import { E_VAULT_KEY_EXISTS } from '@/lib/error'
import { useToast } from '@/components/toast'
import useLocalStorage, { openLocalStorage, listLocalStorages } from '@/components/use-local-storage'
import { toHex, fromHex } from '@/lib/hex'

function useConfig () {
  return useLocalStorage({ database: 'vault-config', namespace: ['settings'], supportLegacy: false })
}

/**
 * An hook to configure the vault for the current user
 */
export function useVaultConfigurator () {
  const { me } = useMe()
  const toaster = useToast()
  const [setVaultKeyHash] = useMutation(SET_VAULT_KEY_HASH)

  const [vaultKey, innerSetVaultKey] = useState(null)
  const [config, configError] = useConfig()

  useEffect(() => {
    if (!me) return
    if (configError) {
      toaster.danger('error loading vault configuration ' + configError.message)
      return
    }
    (async () => {
      let localVaultKey = await config.get('key')
      if (localVaultKey && (!me.privates.vaultKeyHash || localVaultKey?.hash !== me.privates.vaultKeyHash)) {
        // If the hash stored in the server does not match the hash of the local key,
        // we can tell that the key is outdated (reset by another device or other reasons)
        // in this case we clear the local key and let the user re-enter the passphrase
        console.log('vault key hash mismatch, clearing local key')
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
 * An hook to migrate local storage to the synched vault
 */
export function useVaultMigration () {
  const { me } = useMe()
  const toaster = useToast()
  const [setVaultEntry] = useMutation(SET_ENTRY)
  const [config, configError] = useConfig()

  useEffect(() => {
    if (configError) {
      toaster.danger('error loading vault configuration ' + configError.message)
    }
  }, [configError])

  // migrate local storage to vault
  const migrate = useCallback(async () => {
    const vaultKey = await config.get('key')
    if (!vaultKey) throw new Error('vault key not found')
    let migratedCount = 0

    // we collect all the stores used by the vault (+legacy ie. stuff saved before we had the vault logic)
    const namespaces = await listLocalStorages({ userId: me?.id, database: 'vault', supportLegacy: true })
    for (const namespace of namespaces) {
      // we open every one of them and copy the entries to the vault
      const storage = await openLocalStorage({ userId: me?.id, database: 'vault', namespace, supportLegacy: true })
      const entryNames = await storage.list()
      for (const entryName of entryNames) {
        try {
          const value = await storage.get(entryName)
          if (!value) throw new Error('no value found in local storage')
          if (!namespace[0] || !namespace[1] || isNaN(namespace[1])) throw new Error('unknown vault namespace layout')
          // encrypt and store on the server
          const encrypted = await encryptData(vaultKey.key, value)
          const { data } = await setVaultEntry({
            variables: {
              key: entryName,
              value: encrypted,
              skipIfSet: true,
              ownerType: namespace[0],
              ownerId: Number(namespace[1])
            }
          })
          if (data?.setVaultEntry) {
            // clear local storage
            await storage.unset(entryName)
            migratedCount++
            console.log('migrated to vault:', entryName)
          } else {
            throw new Error('could not set vault entry')
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

/**
 * A hook to access the vault for the given object
 * @param {Object} object - represent an entry of a model that implements VaultOwner in the server
 * @param {String} object.id - the id of the owner of the vault
 * @param {String} object.type - the type of the owner of the vault
 * @param {String} object.vault - the prefetched vault data (optional)
 * @param {String} object.defaultKey - the default key to use if no key is used in the set/get calls (optional)
 * @param {String} object.defaultValue - the default value to return if no value is found in the vault (default: undefined)
 * @param {Boolean} object.localOnly - whether to use local storage only (default: false)
 *
 * @returns
 */
export default function useVault (owner, key, defaultValue, localOnly) {
  const { me } = useMe()
  const toaster = useToast()
  const apollo = useApolloClient()
  if (!me) localOnly = true // if anon user -> we force local only

  const [type, setType] = useState(owner.type || owner.__typename)
  const [id, setId] = useState(owner.id)

  const [setVaultValue] = useMutation(SET_ENTRY)
  const [clearVaultValue] = useMutation(UNSET_ENTRY)

  const [config, configError] = useConfig()
  const [localStore, localStoreError] = useLocalStorage({ database: localOnly ? 'local-vault' : 'vault', namespace: [type, id], supportLegacy: true })

  const [value, innerSetValue] = useState(undefined)

  useEffect(() => {
    if (owner?.id !== id) setId(owner?.id)
    if ((owner?.type || owner?.__typename) !== type) setType(owner?.type || owner?.__typename)
  }, [owner])

  useEffect(() => {
    if (configError) {
      toaster.danger('error loading vault configuration ' + configError.message)
    }
    if (localStoreError) {
      toaster.danger('error loading local storage ' + localStoreError.message)
    }
  }, [configError, localStoreError])

  const refreshData = useCallback(async () => {
    if (localOnly) {
      // local only: we fetch from local storage and return
      innerSetValue((await localStore.get(key)) || defaultValue)
      return
    }

    const localVaultKey = await config.get('key')

    if (!me.privates.vaultKeyHash || localVaultKey?.hash !== me.privates.vaultKeyHash) {
      // no or different vault setup on server: use unencrypted local storage
      // and clear local key if it exists
      await config.unset('key')
      innerSetValue((await localStore.get(key)) || defaultValue)
      return
    }

    // if vault key hash is set on the server and matches our local key, we try to fetch from the vault
    {
      const { data: queriedData, error: queriedError } = await apollo.query({
        query: GET_ENTRY,
        variables: { key, ownerId: owner.id, ownerType: owner.type || owner.__typename },
        nextFetchPolicy: 'no-cache',
        fetchPolicy: 'no-cache'
      })
      if (queriedError) throw queriedError
      console.log('Vault query', queriedData) // REMOVEME
      const encryptedVaultValue = queriedData?.getVaultEntry?.value
      if (encryptedVaultValue) {
        try {
          const vaultValue = await decryptData(localVaultKey.key, encryptedVaultValue)
          // console.log('decrypted value from vault:', storageKey, encrypted, decrypted)
          innerSetValue(vaultValue)
          // remove local storage value if it exists
          await localStore.unset(key)
          return
        } catch (e) {
          console.error('cannot read vault data:', key, e)
        }
      }
    }

    // fallback to local storage
    innerSetValue((await localStore.get(key)) || defaultValue)
  }, [me?.privates?.vaultKeyHash, localOnly, owner.id, owner.type || owner.__typename, key, defaultValue])

  useEffect(() => {
    refreshData()
  }, [me?.privates?.vaultKeyHash, localOnly, owner.id, owner.type || owner.__typename, key, defaultValue])

  const setValue = useCallback(async (newValue) => {
    const vaultKey = await config.get('key')

    const useVault = vaultKey && vaultKey.hash === me.privates.vaultKeyHash

    if (useVault && !localOnly) {
      const encryptedValue = await encryptData(vaultKey.key, newValue)
      console.log('store encrypted value in vault:', key, encryptedValue)
      await setVaultValue({
        variables: {
          key,
          value: encryptedValue,
          ownerId: owner.id,
          ownerType: owner.type || owner.__typename
        }
      })
      // clear local storage (we get rid of stored unencrypted data as soon as it can be stored on the vault)
      await localStore.unset(key)
    } else {
      console.log('store value in local storage:', key, newValue)
      // otherwise use local storage
      await localStore.set(key, newValue)
    }
    // refresh in-memory value
    innerSetValue(newValue)
  }, [me?.privates?.vaultKeyHash, key, localOnly])

  const clearValue = useCallback(async ({ onlyFromLocalStorage } = {}) => {
    // unset a value
    // clear server
    const vaultKey = await config.get('key')
    const useVault = vaultKey && vaultKey.hash === me.privates.vaultKeyHash

    if (!localOnly && useVault && !onlyFromLocalStorage) {
      await clearVaultValue({
        variables: {
          key,
          ownerId: owner.id,
          ownerType: owner.type || owner.__typename
        }
      })
    }
    // clear local storage
    await localStore.unset(key)
    // clear in-memory value
    innerSetValue(undefined)
    // refresh in-memory value
    await refreshData()
  }, [key, localOnly, refreshData])

  return [value, setValue, clearValue, refreshData]
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
