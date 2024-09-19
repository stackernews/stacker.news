import { SSR } from '@/lib/constants'
import { useCallback, useState, useEffect } from 'react'
import { useMe } from '@/components/me'
import { useMutation, useQuery } from '@apollo/client'
import { GET_ENTRY, SET_ENTRY, UNSET_ENTRY, CLEAR_VAULT, SET_VAULT_KEY_HASH } from '@/fragments/userVault'

// used to set and configure the vault
export function useVaultConfigState () {
  const me = useMe()
  const [setVaultKeyHash] = useMutation(SET_VAULT_KEY_HASH)

  // vault key stored locally
  const [value, innerSetValue] = useState(null)

  useEffect(() => {
    if (!SSR) {
      let localVaultKey = getLocalStorage(me?.id, 'vault', { prefix: 'key' })
      if (localVaultKey?.hash !== me?.privates?.vaultKeyHash) {
        // if the vault key is not synced with the server, clear it
        localVaultKey = null
        unsetLocalStorage(me?.id, 'vault', 'key')
      }
      innerSetValue(localVaultKey)
    }
  }, [me?.privates?.vaultKeyHash])

  // clear vault: remove everything and reset the key
  const [clearVault] = useMutation(CLEAR_VAULT, {
    onCompleted: () => {
      unsetLocalStorage(me?.id, 'vault', 'key')
      innerSetValue(null)
    }
  })

  // initialize the vault and set a vault key
  const setVaultKey = useCallback(async (passphrase) => {
    const { key, hash } = await deriveKey(me?.id, passphrase)
    await setVaultKeyHash({
      variables: { hash },
      onError: (error) => {
        const errorCode = error.graphQLErrors[0]?.extensions?.code
        if (errorCode === 'VAULT_KEY_ALREADY_SET') {
          throw new Error('Device sync is already enabled with a different key. Please input the correct key or reset the device sync.')
        } else {
          throw new Error(error)
        }
      }
    })
    innerSetValue({ passphrase, key, hash })
    if (!SSR) setLocalStorage(me?.id, 'vault', { passphrase, key, hash }, 'key')
  })

  // disconnect the user from the vault (will not clear or reset the passphrase, use clearVault for that)
  const disconnectVault = useCallback(() => {
    if (!SSR) unsetLocalStorage(me?.id, 'vault', 'key')
    innerSetValue(null)
  })

  return [value, setVaultKey, clearVault, disconnectVault]
}

// use to migrate the local storage to vault (do not overwrite existing vault entries)
export function useLocalStorageToVaultMigration () {
  const me = useMe()
  const [setVaultValue] = useMutation(SET_ENTRY)

  // count how many local storage keys can be migrated
  const count = SSR ? 0 : getMigrableStorageKeys(me?.id).length

  // migrate local storage to vault
  const migrate = async () => {
    if (SSR) return
    const vaultKey = getLocalStorage(me?.id, 'vault', { prefix: 'key' })
    if (!vaultKey) throw new Error('vault key not found')
    const keys = getMigrableStorageKeys(me?.id)
    let migratedCount = 0
    for (const key of keys) {
      const localStorageValue = window.localStorage.getItem(key.localKey)
      if (localStorageValue) {
        const encryptedValue = await encryptStorageData(vaultKey.key, localStorageValue)
        const res = await setVaultValue({ variables: { key: key.vaultKey, value: encryptedValue, skipIfSet: true } })
        if (res?.data?.setVaultEntry) {
          console.info(localStorageValue, 'migrated to vault', vaultKey.key, res)
          window.localStorage.removeItem(key.localKey)
          migratedCount++
        } else {
          console.warn(localStorageValue, 'could be migrated to vault', vaultKey.key)
        }
      }
    }
    return migratedCount
  }

  return [count, migrate]
}

// used to get and set values in the vault
export default function useVaultStorageState (storageKey, defaultValue) {
  const me = useMe()
  const [setVaultValue] = useMutation(SET_ENTRY)
  const [clearVaultValue] = useMutation(UNSET_ENTRY)
  const [value, innerSetValue] = useState(undefined)
  const { data: vaultData, refetch: refetchVaultValue } = useQuery(GET_ENTRY, {
    variables: { key: storageKey },
    fetchPolicy: 'no-cache'
  })

  useEffect(() => {
    if (SSR) return
    (async () => {
      const vaultKey = getLocalStorage(me?.id, 'vault', { prefix: 'key' })
      if (me?.privates?.vaultKeyHash && vaultKey?.hash === me.privates.vaultKeyHash) {
        // if vault key hash is set on the server, vault entry exists and vault key is set on the device
        // decrypt and use the value from the server
        if (vaultData?.getVaultEntry?.value) {
          try {
            const decryptedData = JSON.parse(await decryptStorageData(vaultKey.key, vaultData?.getVaultEntry?.value))
            innerSetValue(decryptedData)
            // remove local storage value
            unsetLocalStorage(me?.id, storageKey)
            return
          } catch (e) {
            console.error('Cannot read vault data', e)
          }
        }
      } else {
        // if the vault key is unsynced, we clear it from local storage
        unsetLocalStorage(me?.id, 'vault', 'key')
      }

      if (getLocalStorage(me?.id, storageKey, { backwardCompatible: true })) {
        // otherwise, if there is a local storage use, return that
        try {
          innerSetValue(getLocalStorage(me?.id, storageKey, { backwardCompatible: true }))
          return
        } catch (e) {
          console.error('Cannot read local storage data', e)
        }
      }
      // otherwise, use the default value
      innerSetValue(defaultValue)
    })()
  }, [vaultData, me?.privates?.vaultKeyHash])

  const setValue = useCallback(async (newValue) => {
    if (SSR) return
    const vaultKey = getLocalStorage(me?.id, 'vault', { prefix: 'key' })
    const userVault = me?.privates?.vaultKeyHash
    if (userVault && vaultKey && vaultKey.hash === userVault && vaultKey.key) {
      // if vault key is enabled an properly connected, set the value in the server
      const encryptedValue = await encryptStorageData(vaultKey.key, JSON.stringify(newValue))
      await setVaultValue({ variables: { key: storageKey, value: encryptedValue } })
      // clear local storage (we get rid of stored unencrypted data as soon as it can be stored on the vault)
      unsetLocalStorage(me?.id, storageKey)
    } else {
      // otherwise use local storage
      setLocalStorage(me?.id, storageKey, newValue)
    }
    // refresh in-memory value
    innerSetValue(newValue)
  }, [me?.privates?.vaultKeyHash])

  const clearValue = useCallback(async () => {
    // unset a value
    if (SSR) return
    // clear server
    await clearVaultValue({ variables: { key: storageKey } })
    await refetchVaultValue()
    // clear local storage
    unsetLocalStorage(me?.id, storageKey)
    // clear in-memory value
    innerSetValue(undefined)
  }, [])

  return [value, setValue, clearValue, refetchVaultValue]
}

function getMigrableStorageKeys (userId) {
  // get all the local storage keys that can be migrated
  if (!userId) return []
  const out = []
  const vaultPrefix = 'vault:'
  const vaultSuffix = ':' + userId
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith(vaultPrefix) && key.endsWith(vaultSuffix)) {
      // everything that is set by the local storage vault (ie. if the user doesn't have device sync enabled yet)
      out.push({
        vaultKey: key.substring(vaultPrefix.length, key.length - vaultSuffix.length),
        localKey: key
      })
    } else if (key.startsWith('wallet:') && key.endsWith(':' + userId)) {
      // every old setting related to the wallet attachments
      out.push({
        vaultKey: key,
        localKey: key
      })
    }
    // check here for more keys that can be migrated if needed
  }
  return out
}

function setLocalStorage (userId, key, value, prefix = 'vault') {
  window.localStorage.setItem(prefix + ':' + key + ':' + userId, JSON.stringify(value))
}

function getLocalStorage (userId, key, { prefix = 'vault', backwardCompatible = false }) {
  const v = window.localStorage.getItem(prefix + ':' + key + ':' + userId)
  if (v) {
    return JSON.parse(v)
  }
  if (backwardCompatible) {
    const vb = window.localStorage.getItem(key)
    return vb ? JSON.parse(vb) : null
  }
  return null
}

function unsetLocalStorage (userId, key, prefix = 'vault') {
  window.localStorage.removeItem(prefix + ':' + key + ':' + userId)
}

function toHex (buffer) {
  const byteArray = new Uint8Array(buffer)
  const hexString = Array.from(byteArray, byte => byte.toString(16).padStart(2, '0')).join('')
  return hexString
}

function fromHex (hex) {
  const byteArray = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
  return byteArray.buffer
}

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
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
  const rawKey = await window.crypto.subtle.exportKey('raw', key)
  const rawHash = await window.crypto.subtle.digest('SHA-256', rawKey)
  return {
    key: toHex(rawKey),
    hash: toHex(rawHash)
  }
}

async function encryptStorageData (key, data) {
  key = await window.crypto.subtle.importKey(
    'raw',
    fromHex(key),
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  )
  const enc = new TextEncoder()
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    enc.encode(data)
  )
  return JSON.stringify({
    iv: toHex(iv.buffer),
    data: toHex(encrypted)
  })
}

async function decryptStorageData (key, encryptedData) {
  let { iv, data } = JSON.parse(encryptedData)
  iv = fromHex(iv)
  data = fromHex(data)
  key = await window.crypto.subtle.importKey(
    'raw',
    fromHex(key),
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  )
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    data
  )
  const dec = new TextDecoder()
  return dec.decode(decrypted)
}
