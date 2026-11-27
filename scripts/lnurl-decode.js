#!/usr/bin/env node
const { bech32 } = require('bech32')

const lnurl = process.argv[2]
if (!lnurl) {
  console.error('Usage: lnurl-decode.js <lnurl>')
  process.exit(1)
}
try {
  const { words } = bech32.decode(lnurl, 2000)
  const url = Buffer.from(bech32.fromWords(words)).toString('utf8')
  console.log(url)
} catch (err) {
  console.error('Failed to decode LNURL:', err.message)
  process.exit(1)
}
