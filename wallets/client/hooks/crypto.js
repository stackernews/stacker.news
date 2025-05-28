import { useCallback, useEffect, useState } from 'react'
import { fromHex, toHex } from '@/lib/hex'
import { useMe } from '@/components/me'
import { useIndexedDB } from '@/components/use-indexeddb'

function useKey () {
  const [key, setKey] = useState(null)
  const { get } = useIndexedDB()
  const { me } = useMe()

  useEffect(() => {
    if (!me?.id) return
    get('vault', 'key').then(key => setKey(key))
  }, [me?.id])

  return key
}

export function useEncryption () {
  const key = useKey()
  return useCallback(value => key ? encrypt(key, value) : null, [key])
}

export function useDecryption () {
  const key = useKey()
  return useCallback(value => key ? decrypt(key, value) : null, [key])
}

// TODO(wallet-v2): remove eslint-disable-next-line when this is used
// eslint-disable-next-line no-unused-vars
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

async function encrypt (key, value) {
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
    key,
    encoded
  )
  return {
    iv: toHex(iv.buffer),
    value: toHex(encrypted)
  }
}

async function decrypt (key, { iv, value }) {
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromHex(iv)
    },
    key,
    fromHex(value)
  )
  const decoded = new TextDecoder().decode(decrypted)
  return JSON.parse(decoded)
}
