import { createHash } from 'node:crypto'

export function hashEmail ({
  email,
  salt = process.env.EMAIL_SALT
}) {
  const saltedEmail = `${email.toLowerCase()}${salt}`
  return createHash('sha256').update(saltedEmail).digest('hex')
}
