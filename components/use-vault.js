import { useCallback, useState, useEffect } from 'react'
import { useMe } from '@/components/me'
import { useMutation, useQuery } from '@apollo/client'
import { GET_ENTRY, SET_ENTRY, UNSET_ENTRY, CLEAR_VAULT, SET_VAULT_KEY_HASH } from '@/fragments/vault'
import { E_VAULT_KEY_EXISTS } from '@/lib/error'

export function useVaultConfigurator () {
  const { me } = useMe()
  const [setVaultKeyHash] = useMutation(SET_VAULT_KEY_HASH)

  // vault key stored locally
  const [vaultKey, innerSetVaultKey] = useState(null)

  useEffect(() => {
    if (!me) return

    let localVaultKey = getLocalKey(me.id)

    if (!me.privates.vaultKeyHash || localVaultKey?.hash !== me.privates.vaultKeyHash) {
      // We can tell that another device has reset the vault if the values
      // on the server are encrypted with a different key or no key exists anymore.
      // In that case, our local key is no longer valid and our device needs to be connected
      // to the vault again by entering the correct passphrase.
      localVaultKey = null
      unsetLocalKey(me.id)
    }

    innerSetVaultKey(localVaultKey)
  }, [me?.privates?.vaultKeyHash])

  // clear vault: remove everything and reset the key
  const [clearVault] = useMutation(CLEAR_VAULT, {
    onCompleted: () => {
      unsetLocalKey(me.id)
      innerSetVaultKey(null)
    }
  })

  // initialize the vault and set a vault key
  const setVaultKey = useCallback(async (passphrase) => {
    const { key, hash } = await deriveKey(me.id, passphrase)
    await setVaultKeyHash({
      variables: { hash },
      onError: (error) => {
        const errorCode = error.graphQLErrors[0]?.extensions?.code
        if (errorCode === E_VAULT_KEY_EXISTS) {
          throw new Error('wrong passphrase')
        }
        throw new Error(error)
      }
    })
    innerSetVaultKey({ passphrase, key, hash })
    setLocalKey(me.id, { passphrase, key, hash })
  }, [setVaultKeyHash])

  // disconnect the user from the vault (will not clear or reset the passphrase, use clearVault for that)
  const disconnectVault = useCallback(() => {
    unsetLocalKey(me.id)
    innerSetVaultKey(null)
  }, [unsetLocalKey, innerSetVaultKey])

  return [vaultKey, setVaultKey, clearVault, disconnectVault]
}

export function useVaultMigration () {
  const { me } = useMe()
  const [setVaultEntry] = useMutation(SET_ENTRY)

  // migrate local storage to vault
  const migrate = useCallback(async () => {
    const vaultKey = getLocalKey(me.id)
    if (!vaultKey) throw new Error('vault key not found')

    let migratedCount = 0

    for (const migratableKey of retrieveMigratableKeys(me.id)) {
      try {
        const value = JSON.parse(window.localStorage.getItem(migratableKey.localStorageKey))
        if (!value) throw new Error('no value found in local storage')

        const encrypted = await encryptJSON(vaultKey.key, value)

        const { data } = await setVaultEntry({ variables: { key: migratableKey.vaultStorageKey, value: encrypted, skipIfSet: true } })
        if (data?.setVaultEntry) {
          window.localStorage.removeItem(migratableKey.localStorageKey)
          migratedCount++
          console.log('migrated to vault:', migratableKey)
        } else {
          throw new Error('could not set vault entry')
        }
      } catch (e) {
        console.error('failed migrate to vault:', migratableKey, e)
      }
    }

    return migratedCount
  }, [me?.id])

  return migrate
}

// used to get and set values in the vault
export default function useVault (vaultStorageKey, defaultValue, options = { localOnly: false }) {
  const { me } = useMe()
  const { localOnly } = options

  // This is the key that we will use in local storage whereas vaultStorageKey is the key that we
  // will use on the server ("the vault").
  const localStorageKey = getLocalStorageKey(vaultStorageKey, me?.id, localOnly)

  const [setVaultValue] = useMutation(SET_ENTRY)
  const [value, innerSetValue] = useState(undefined)
  const [clearVaultValue] = useMutation(UNSET_ENTRY)
  const { data: vaultData, refetch: refetchVaultValue } = useQuery(GET_ENTRY, {
    variables: { key: vaultStorageKey },
    // fetchPolicy only applies to first execution on mount so we also need to
    // set nextFetchPolicy to make sure we don't serve stale values from cache
    nextFetchPolicy: 'no-cache',
    fetchPolicy: 'no-cache'
  })

  useEffect(() => {
    (async () => {
      if (!me) return

      if (localOnly) {
        innerSetValue(getLocalStorage(localStorageKey) || defaultValue)
        return
      }

      const localVaultKey = getLocalKey(me.id)

      if (!me.privates.vaultKeyHash || localVaultKey?.hash !== me.privates.vaultKeyHash) {
        // no or different vault setup on server
        // use unencrypted local storage
        unsetLocalKey(me.id)
        innerSetValue(getLocalStorage(localStorageKey) || defaultValue)
        return
      }

      // if vault key hash is set on the server, vault entry exists and vault key is set on the device
      // decrypt and use the value from the server
      const encrypted = vaultData?.getVaultEntry?.value
      if (encrypted) {
        try {
          const decrypted = await decryptJSON(localVaultKey.key, encrypted)
          // console.log('decrypted value from vault:', storageKey, encrypted, decrypted)
          innerSetValue(decrypted)
          // remove local storage value if it exists
          unsetLocalStorage(localStorageKey)
          return
        } catch (e) {
          console.error('cannot read vault data:', vaultStorageKey, e)
        }
      }

      // fallback to local storage
      innerSetValue(getLocalStorage(localStorageKey) || defaultValue)
    })()
  }, [vaultData, me?.privates?.vaultKeyHash, localOnly])

  const setValue = useCallback(async (newValue) => {
    const vaultKey = getLocalKey(me.id)

    const useVault = vaultKey && vaultKey.key && vaultKey.hash === me.privates.vaultKeyHash

    if (useVault && !localOnly) {
      const encryptedValue = await encryptJSON(vaultKey.key, newValue)
      await setVaultValue({ variables: { key: vaultStorageKey, value: encryptedValue } })
      console.log('stored encrypted value in vault:', vaultStorageKey, newValue, encryptedValue)
      // clear local storage (we get rid of stored unencrypted data as soon as it can be stored on the vault)
      unsetLocalStorage(localStorageKey)
    } else {
      console.log('stored value in local storage:', localStorageKey, newValue)
      // otherwise use local storage
      setLocalStorage(localStorageKey, newValue)
    }
    // refresh in-memory value
    innerSetValue(newValue)
  }, [me?.privates?.vaultKeyHash, localStorageKey, vaultStorageKey, localOnly])

  const clearValue = useCallback(async () => {
    // unset a value
    // clear server
    if (!localOnly) {
      await clearVaultValue({ variables: { key: vaultStorageKey } })
      await refetchVaultValue()
    }
    // clear local storage
    unsetLocalStorage(localStorageKey)
    // clear in-memory value
    innerSetValue(undefined)
  }, [vaultStorageKey, localStorageKey, localOnly])

  return [value, setValue, clearValue, refetchVaultValue]
}

function retrieveMigratableKeys (userId) {
  // get all the local storage keys that can be migrated
  const out = []

  for (const key of Object.keys(window.localStorage)) {
    if (key.includes(':local-only:')) continue
    if (!key.endsWith(`:${userId}`)) continue

    if (key.startsWith('vault:')) {
      out.push({
        vaultStorageKey: key.substring('vault:'.length, key.length - `:${userId}`.length),
        localStorageKey: key
      })
    }

    // required for backwards compatibility with keys that were stored before we had the vault
    if (key.startsWith('wallet:')) {
      out.push({
        vaultStorageKey: key.substring(0, key.length - `:${userId}`.length),
        localStorageKey: key
      })
    }
  }
  return out
}

function getLocalStorageKey (key, userId, localOnly) {
  // We prefix localStorageKey with 'vault:' so we know which
  // keys we need to migrate to the vault when device sync is enabled.
  let localStorageKey = `vault:${key}`

  // wallets like WebLN don't make sense to share across devices since they rely on a browser extension.
  // We check for this ':local-only:' tag during migration to skip any keys that contain it.
  if (localOnly) {
    localStorageKey = `vault:local-only:${key}`
  }

  // always scope to user to avoid messing with wallets of other users on same device that might exist
  return `${localStorageKey}:${userId}`
}

function setLocalStorage (key, value) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function setLocalKey (userId, key) {
  return window.localStorage.setItem(`vault-key:local-only:${userId}`, JSON.stringify(key))
}

function getLocalStorage (key) {
  let v = window.localStorage.getItem(key)

  // ensure backwards compatible with wallet keys that we used before we had the vault
  if (!v) {
    const oldKey = key.replace(/vault:(local-only:)?/, '')
    v = window.localStorage.getItem(oldKey)
  }

  return v ? JSON.parse(v) : null
}

function unsetLocalStorage (key) {
  window.localStorage.removeItem(key)
}

function getLocalKey (userId) {
  return JSON.parse(window.localStorage.getItem(`vault-key:local-only:${userId}`) || '{}')
}

function unsetLocalKey (userId) {
  return window.localStorage.removeItem(`vault-key:local-only:${userId}`)
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
  const rawHash = await window.crypto.subtle.digest('SHA-256', rawKey)
  return {
    key: toHex(rawKey),
    hash: toHex(rawHash)
  }
}

async function encryptJSON (key, jsonData) {
  key = await window.crypto.subtle.importKey(
    'raw',
    fromHex(key),
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  )

  // random IVs are _really_ important in GCM: reusing the IV once can lead to catastrophic failure
  // see https://crypto.stackexchange.com/questions/26790/how-bad-it-is-using-the-same-iv-twice-with-aes-gcm
  const iv = window.crypto.getRandomValues(new Uint8Array(12))

  const encoded = new TextEncoder().encode(JSON.stringify(jsonData))

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    encoded
  )

  return JSON.stringify({
    iv: toHex(iv.buffer),
    data: toHex(encrypted)
  })
}

async function decryptJSON (key, encryptedData) {
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

  const decoded = new TextDecoder().decode(decrypted)

  return JSON.parse(decoded)
}
