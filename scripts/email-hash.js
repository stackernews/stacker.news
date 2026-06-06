#!/usr/bin/env node

// Derive the emailHash that Stacker News stores for a user.
// Must stay in sync with hashEmail in lib/crypto.js and the
// migrate_existing_user_emails SQL function: sha256(lower(email) + salt) as hex.

const { createHash } = require('node:crypto')

function usage () {
  console.log('Usage: scripts/email-hash.js <email> [salt]')
  console.log('  salt defaults to the EMAIL_SALT environment variable')
  process.exit(1)
}

const [email, saltArg] = process.argv.slice(2)
const salt = saltArg ?? process.env.EMAIL_SALT

if (!email || salt === undefined) {
  usage()
}

const saltedEmail = `${email.toLowerCase()}${salt}`
console.log(createHash('sha256').update(saltedEmail).digest('hex'))
