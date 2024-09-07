import { SSR } from '@/lib/constants'
import { useCallback, useState, useEffect } from 'react'
import { useMe } from '@/components/me'
import { useMutation, useQuery } from '@apollo/client'
import { GET_ENTRY, SET_ENTRY, UNSET_ENTRY, CLEAR_VAULT, SET_VAULT_KEY_HASH } from '@/fragments/userVault'

export function useVaultConfigState () {
  const [setVaultKeyHash] = useMutation(SET_VAULT_KEY_HASH)

  const [value, innerSetValue] = useState(SSR ? null : JSON.parse(window.localStorage.getItem('user-vault-key') || 'null'))

  const [clearVault] = useMutation(CLEAR_VAULT, {
    onCompleted: () => {
      window.localStorage.removeItem('user-vault-key')
      innerSetValue(null)
    }
  })

  const setVaultKey = useCallback(async (passphrase) => {
    const { key, hash } = await deriveStorageKey(passphrase)
    innerSetValue({ passphrase, key, hash })
    window.localStorage.setItem('user-vault-key', JSON.stringify({ passphrase, key, hash }))
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
  })

  const disconnectVault = useCallback(() => {
    if (!SSR) window.localStorage.removeItem('user-vault-key')
    innerSetValue(null)
  })

  return [value, setVaultKey, clearVault, disconnectVault]
}

export default function useVaultStorageState (storageKey, defaultValue) {
  const me = useMe()
  const { data: vaultData, refetch: refetchVaultValue } = useQuery(GET_ENTRY, {
    variables: { key: storageKey },
    fetchPolicy: 'no-cache'
  })
  const getLocalValue = useCallback(() => {
    return JSON.parse(window.localStorage.getItem('vault-' + storageKey))
  }, [storageKey])
  const [value, innerSetValue] = useState(() => {
    if (SSR) return null
    return (me?.privates?.vaultKeyHash ? vaultData?.getVaultEntry?.value : getLocalValue()) || defaultValue
  })
  const [setVaultValue] = useMutation(SET_ENTRY)
  const [clearVaultValue] = useMutation(UNSET_ENTRY)

  useEffect(() => {
    if (SSR) return
    (async () => {
      const vaultKey = JSON.parse(window.localStorage.getItem('user-vault-key') || 'null')
      console.log(vaultData?.getVaultEntry?.value)
      if (me?.privates?.vaultKeyHash && vaultData?.getVaultEntry?.value && vaultKey) {
        const decryptedData = await decryptStorageData(vaultKey.key, vaultData?.getVaultEntry?.value)
        innerSetValue(decryptedData)
        window.localStorage.removeItem('vault-' + storageKey)
      } else if (getLocalValue()) {
        innerSetValue(getLocalValue())
      } else {
        innerSetValue(defaultValue)
      }
    })()
  }, [vaultData, getLocalValue, me?.privates?.vaultKeyHash, defaultValue, storageKey])

  const setValue = useCallback(async (newValue) => {
    if (SSR) return
    const vaultKey = JSON.parse(window.localStorage.getItem('user-vault-key') || 'null')
    const userVault = me?.privates?.vaultKeyHash
    // if device sync is enabled, retrieve the data from the server
    if (userVault && vaultKey) {
      console.log('Device sync enabled')
      const { hash, key } = vaultKey
      if (hash === userVault) {
        const encryptedValue = await encryptStorageData(key, JSON.stringify(newValue))
        await setVaultValue({ variables: { key: storageKey, value: encryptedValue } })
        window.localStorage.removeItem('vault-' + storageKey)
      } else {
        console.log('Device sync enabled with different key, storing locally')
        window.localStorage.setItem('vault-' + storageKey, JSON.stringify(newValue))
      }
    } else {
      console.log('Device sync not enabled', userVault, vaultKey)
      window.localStorage.setItem('vault-' + storageKey, JSON.stringify(newValue))
    }
    innerSetValue(newValue)
  }, [me, storageKey, setVaultValue])

  const clearValue = useCallback(async () => {
    if (SSR) return
    await clearVaultValue({ variables: { key: storageKey } })
    await refetchVaultValue()
    // clear locally
    window.localStorage.removeItem('vault-' + storageKey)
    innerSetValue(undefined)
  }, [storageKey, clearVaultValue])

  return [value, setValue, clearValue, refetchVaultValue]
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

async function deriveStorageKey (passphrase) {
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
      salt: enc.encode('stacker news'),
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
  const hash = await window.crypto.subtle.digest('SHA-256', encrypted)
  return JSON.stringify({
    iv: toHex(iv.buffer),
    data: toHex(encrypted),
    hash: toHex(hash)
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
