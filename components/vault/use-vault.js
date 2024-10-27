import { useCallback } from 'react'
import { useVaultConfigurator } from './use-vault-configurator'
import { fromHex, toHex } from '@/lib/hex'

export default function useVault () {
  const { key } = useVaultConfigurator()

  const encrypt = useCallback(async (value) => {
    if (!key) throw new Error('no vault key set')
    return await encryptValue(key.key, value)
  }, [key])

  const decrypt = useCallback(async ({ iv, value }) => {
    if (!key) throw new Error('no vault key set')
    return await decryptValue(key.key, { iv, value })
  }, [key])

  return { encrypt, decrypt, isActive: !!key }
}

/**
 * Encrypt data using AES-GCM
 * @param {CryptoKey} sharedKey - the key to use for encryption
 * @param {Object} value - the value to encrypt
 * @returns {Promise<Object>} an object with iv and value properties, can be passed to decryptValue to get the original data back
 */
export async function encryptValue (sharedKey, value) {
  // random IVs are _really_ important in GCM: reusing the IV once can lead to catastrophic failure
  // see https://crypto.stackexchange.com/questions/26790/how-bad-it-is-using-the-same-iv-twice-with-aes-gcm
  // 12 bytes (96 bits) is the recommended IV size for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(value))
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    sharedKey,
    encoded
  )
  return {
    iv: toHex(iv.buffer),
    value: toHex(encrypted)
  }
}

/**
 * Decrypt data using AES-GCM
 * @param {CryptoKey} sharedKey - the key to use for decryption
 * @param {Object} encryptedValue - the encrypted value as returned by encryptValue
 * @returns {Promise<Object>} the original unencrypted data
 */
export async function decryptValue (sharedKey, { iv, value }) {
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromHex(iv)
    },
    sharedKey,
    fromHex(value)
  )
  const decoded = new TextDecoder().decode(decrypted)
  return JSON.parse(decoded)
}
