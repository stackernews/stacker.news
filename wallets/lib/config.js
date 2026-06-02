import { sha256 } from '@noble/hashes/sha2.js'

function stableObjectString (value) {
  const object = value ?? {}
  const stableObject = Object.fromEntries(
    Object.keys(object).sort().map(key => [key, object[key]])
  )
  return JSON.stringify(stableObject)
}

export function stableObjectHash (value) {
  return Buffer.from(sha256(Buffer.from(stableObjectString(value)))).toString('hex')
}
