import useVault from '@/components/vault/use-vault'
import { encryptedPrivates, validateSchema, encryptedPrivatesSchema } from '@/lib/validate'
import { setValue as setLocalValue, getValue as getLocalValue, clearValue as clearLocalValue } from '@/components/use-local-state'
import { SET_ENCRYPTED_SETTINGS } from '@/fragments/users'
import { useMutation } from '@apollo/client'
import { useState, useCallback, useEffect } from 'react'

export function useEncryptedPrivates ({ me }) {
  const { isActive, decrypt: decryptVault, encrypt: encryptVault, key: vaultKey } = useVault()

  const [innerSetEncryptedSettings] = useMutation(SET_ENCRYPTED_SETTINGS, {
    update (cache, { data: { setSettings } }) {
      cache.modify({
        id: 'ROOT_QUERY',
        fields: {
          settings () {
            return setSettings
          }
        }
      })
    }
  })

  const [innerEncryptedPrivatesState, innerSetEncryptedPrivatesState] = useState({})
  const storageKey = (key) => `privates-${key}-${me?.id}`

  const clearLocalEncryptedPrivates = useCallback(() => {
    for (const key of encryptedPrivates) {
      clearLocalValue(storageKey(key))
    }
  }, [encryptedPrivates])

  /**
   * Get and decrypt signer data from vaultEntries if vault is active, or from local storage if vault is not active
   */
  const getEncryptedPrivates = useCallback(async () => {
    const decryptedEntries = {}
    if (isActive && me?.encryptedPrivates?.length) {
      // async decrypt all vault entries
      const vaultEntriesPromises = await Promise.allSettled(me?.encryptedPrivates
        .filter(e => encryptedPrivates.includes(e.key))
        .map(async entry => {
          const decryptedValue = await decryptVault({ iv: entry.iv, value: entry.value })
          return { key: entry.key, value: decryptedValue }
        })
      )

      // merge to the decryptedEntries object
      for (const p of vaultEntriesPromises) {
        if (p.status === 'fulfilled') {
          const { key, value } = p.value
          decryptedEntries[key] = value
        }
      }
    }

    // get missing entries from the local storage
    for (const key of encryptedPrivates) {
      if (!decryptedEntries[key]) {
        const localValue = getLocalValue(storageKey(key))
        if (localValue) decryptedEntries[key] = localValue
      }
    }
    await validateSchema(encryptedPrivatesSchema, decryptedEntries)
    return decryptedEntries
  }, [isActive, me, vaultKey, decryptVault])

  /**
   * Save encrypted signer data to vaultEntries in userSettings, or to local storage if vault is not active
   */
  const setEncryptedSettings = useCallback(async (entries) => {
    await validateSchema(encryptedPrivatesSchema, entries)
    if (isActive) {
      const encryptedPrivates = await Promise.all(Object.entries(entries).map(async ([key, value]) => {
        return {
          key,
          ...await encryptVault(value)
        }
      }))
      innerSetEncryptedSettings({ variables: { settings: encryptedPrivates } })
    } else {
      for (const [key, value] of Object.entries(entries)) {
        setLocalValue(storageKey(key), value)
      }
    }
  }, [isActive, encryptVault, innerSetEncryptedSettings])

  const refreshEncryptedPrivates = useCallback(async () => {
    const privates = await getEncryptedPrivates()
    innerSetEncryptedPrivatesState(privates)
  }, [innerSetEncryptedPrivatesState, getEncryptedPrivates])

  useEffect(() => {
    refreshEncryptedPrivates()
  }, [me, refreshEncryptedPrivates])

  const onVaultKeySet = useCallback(async (encrypt) => {
    const entriesToSync = encryptedPrivates
      .map(k => {
        const value = getLocalValue(storageKey(k))
        return value ? { key: k, value } : null
      }).filter(v => v)
    if (encrypt && entriesToSync.length > 0) {
      const encryptedSettings = await Promise.all(entriesToSync
        .map(async ({ key, value }) => {
          return {
            key,
            ...await encrypt(value)
          }
        }))
      innerSetEncryptedSettings({ variables: { settings: encryptedSettings } })
      clearLocalEncryptedPrivates()
    }
  }, [getLocalValue, setEncryptedSettings, clearLocalEncryptedPrivates])

  const beforeDisconnectVault = useCallback(async () => {
    const vaultEncryptedPrivates = await getEncryptedPrivates()
    for (const [key, value] of Object.entries(vaultEncryptedPrivates)) {
      setLocalValue(storageKey(key), value)
    }
    refreshEncryptedPrivates()
  }, [getEncryptedPrivates, refreshEncryptedPrivates])

  return { encryptedPrivates: innerEncryptedPrivatesState, getEncryptedPrivates, setEncryptedSettings, clearLocalEncryptedPrivates, onVaultKeySet, beforeDisconnectVault, refreshEncryptedPrivates }
}
