const crypto = require('crypto')

function createInvoiceHmac (hash) {
  const key = Buffer.from(process.env.INVOICE_HMAC_KEY, 'hex')
  return crypto.createHmac('sha256', key).update(Buffer.from(hash, 'hex')).digest('hex')
}

function xor (a, b) {
  const length = Math.max(a.length, b.length)
  const buffer = Buffer.alloc(length)

  for (let i = 0; i < length; ++i) {
    buffer[i] = a[i] ^ b[i]
  }

  return buffer
}

module.exports = { createInvoiceHmac, xor }
