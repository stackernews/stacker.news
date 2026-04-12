#!/usr/bin/env node
const { secp256k1 } = require('@noble/curves/secp256k1')
const { createHash } = require('crypto')
const k1 = process.argv[2]
const identityPubkey = process.argv[3]
const domain = process.argv[4]
const callbackBase = process.argv[5]
if (!k1 || !identityPubkey || !domain || !callbackBase) {
  console.error('Usage: lnurl-auth.js <k1> <identity_pubkey> <domain> <callback_base>')
  process.exit(1)
}
try {
  const linkingKey = createHash('sha256')
    .update(identityPubkey + domain)
    .digest()
  const k1Bytes = Buffer.from(k1, 'hex')
  const signature = secp256k1.sign(k1Bytes, linkingKey)
  const publicKey = secp256k1.getPublicKey(linkingKey)
  const params = new URLSearchParams({
    k1,
    sig: Buffer.from(signature.toCompactRawBytes()).toString('hex'),
    key: Buffer.from(publicKey).toString('hex')
  })
  console.log(`${callbackBase}?${params}`)
} catch (err) {
  console.error('Failed to sign LNURL-auth:', err.message)
  process.exit(1)
}
