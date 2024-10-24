import { useCallback } from 'react'
import { useVaultConfigurator } from './use-vault-configurator'
import { fromHex, toHex } from '@/lib/hex'

export default function useVault () {
  const { key } = useVaultConfigurator()

  const encrypt = useCallback(async (value) => {
    if (!key) throw new Error('no vault key set')
    return await encryptData(key.key, value)
  }, [key])

  const decrypt = useCallback(async (value) => {
    if (!key) throw new Error('no vault key set')
    return await decryptData(key.key, value)
  }, [key])

  return { encrypt, decrypt, isActive: !!key }
}

/**
 * Encrypt data using AES-GCM
 * @param {CryptoKey} sharedKey - the key to use for encryption
 * @param {Object} data - the data to encrypt
 * @returns {Promise<string>} a string representing the encrypted data, can be passed to decryptData to get the original data back
 */
export async function encryptData (sharedKey, data) {
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
export async function decryptData (sharedKey, encryptedData) {
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
