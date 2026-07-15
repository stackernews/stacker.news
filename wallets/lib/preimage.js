import { sha256 } from '@noble/hashes/sha2.js'

// A lightning payment_hash is sha256(preimage), so a valid preimage is proof a payment settled.
// Isomorphic on purpose (safe to call from server or client): uses @noble/hashes rather than
// node:crypto or window.crypto so it runs in either environment.
export function verifyPreimage (hash, preimage) {
  if (!/^[0-9a-f]{64}$/i.test(hash)) return false
  if (!/^[0-9a-f]{64}$/i.test(preimage)) return false
  const preimageHash = Buffer.from(sha256(Buffer.from(preimage, 'hex'))).toString('hex')
  return hash.toLowerCase() === preimageHash
}
