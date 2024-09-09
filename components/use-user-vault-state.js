import { SSR } from '@/lib/constants'
import { useCallback, useState, useEffect } from 'react'
import { useMe } from '@/components/me'
import { useMutation, useQuery } from '@apollo/client'
import { GET_ENTRY, SET_ENTRY, UNSET_ENTRY, CLEAR_VAULT, SET_VAULT_KEY_HASH } from '@/fragments/userVault'

export function useVaultConfigState () {
  const me = useMe()
  const [setVaultKeyHash] = useMutation(SET_VAULT_KEY_HASH)

  const [value, innerSetValue] = useState(SSR ? null : getLocalStorage(me?.id, 'vault', { prefix: 'key' }))

  const [clearVault] = useMutation(CLEAR_VAULT, {
    onCompleted: () => {
      if (!SSR) unsetLocalStorage(me?.id, 'vault', 'key')
      innerSetValue(null)
    }
  })

  const setVaultKey = useCallback(async (passphrase) => {
    const { key, hash } = await deriveStorageKey(me?.id, passphrase)
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

  const disconnectVault = useCallback(() => {
    if (!SSR) unsetLocalStorage(me?.id, 'vault', 'key')
    innerSetValue(null)
  })

  return [value, setVaultKey, clearVault, disconnectVault]
}

export function useLocalStorageToVaultMigration () {
  const me = useMe()
  const [setVaultValue] = useMutation(SET_ENTRY)

  const count = () => {
    if (SSR) return 0
    return getMigrableStorageKeys(me?.id).length
  }

  const migrate = async () => {
    if (SSR) return
    const vaultKey = getLocalStorage(me?.id, 'vault', { prefix: 'key' })
    if (!vaultKey) throw new Error('Unexpected error: vault key not found')
    const keys = getMigrableStorageKeys(me?.id)
    for (const key of keys) {
      const localStorageValue = window.localStorage.getItem(key.localKey)
      if (localStorageValue) {
        console.log('Migrating', key, localStorageValue, vaultKey)
        const encryptedValue = await encryptStorageData(vaultKey.key, localStorageValue)
        await setVaultValue({ variables: { key: key.vaultKey, value: encryptedValue } })
        window.localStorage.removeItem(key.localKey)
      }
    }
  }

  return [count, migrate]
}
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
      if (me?.privates?.vaultKeyHash && vaultData?.getVaultEntry?.value && vaultKey) {
        // if vault key hash is set on the server, vault entry exists and vault key is set on the device
        // decrypt and use the value from the server
        const decryptedData = JSON.parse(await decryptStorageData(vaultKey.key, vaultData?.getVaultEntry?.value))
        innerSetValue(decryptedData)
        // remove local storage value
        unsetLocalStorage(me?.id, storageKey)
      } else if (getLocalStorage(me?.id, storageKey, { backwardCompatible: true })) {
        // otherwise, if there is a local storage use, return that
        innerSetValue(getLocalStorage(me?.id, storageKey, { backwardCompatible: true }))
      } else {
        // otherwise, use the default value
        innerSetValue(defaultValue)
      }
    })()
  }, [vaultData, me?.privates?.vaultKeyHash])

  const setValue = useCallback(async (newValue) => {
    if (SSR) return
    const vaultKey = getLocalStorage(me?.id, 'vault', { prefix: 'key' })
    const userVault = me?.privates?.vaultKeyHash
    // if device sync is enabled, retrieve the data from the server
    if (userVault && vaultKey) {
      const { hash, key } = vaultKey
      if (hash === userVault) {
        const encryptedValue = await encryptStorageData(key, JSON.stringify(newValue))
        await setVaultValue({ variables: { key: storageKey, value: encryptedValue } })
        unsetLocalStorage(me?.id, storageKey)
      } else {
        setLocalStorage(me?.id, storageKey, newValue)
      }
    } else {
      setLocalStorage(me?.id, storageKey, newValue)
    }
    innerSetValue(newValue)
  }, [me?.privates?.vaultKeyHash])

  const clearValue = useCallback(async () => {
    if (SSR) return
    await clearVaultValue({ variables: { key: storageKey } })
    await refetchVaultValue()
    // clear locally
    unsetLocalStorage(me?.id, storageKey)
    innerSetValue(undefined)
  }, [])

  return [value, setValue, clearValue, refetchVaultValue]
}

function getMigrableStorageKeys (userId) {
  if (!userId) return []
  const out = []
  const vaultPrefix = 'vault:'
  const vaultSuffix = ':' + userId
  for (const key of Object.keys(window.localStorage)) {
    console.log(key)
    if (key.startsWith(vaultPrefix) && key.endsWith(vaultSuffix)) {
      out.push({
        vaultKey: key.substring(vaultPrefix.length, key.length - vaultSuffix.length),
        localKey: key
      })
    } else if (key.startsWith('wallet:') && key.endsWith(':' + userId)) {
      out.push({
        vaultKey: key,
        localKey: key
      })
    }
  }
  console.log(out)
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

async function deriveStorageKey (userId, passphrase) {
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
