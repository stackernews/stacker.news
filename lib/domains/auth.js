import { createHash, timingSafeEqual } from 'node:crypto'
import { secureCookie } from '@/lib/auth'

export const DOMAINS_AUTH_VERIFIER_COOKIE = secureCookie('domains_auth_verifier')
export const DOMAINS_AUTH_CHALLENGE_PARAM = 'challenge'
// 10 minutes is plenty for a login flow and matches the verification token TTL ceiling.
export const DOMAINS_AUTH_VERIFIER_TTL_S = 10 * 60
// verifiers are 32 random bytes hex-encoded
export const DOMAINS_AUTH_VERIFIER_BYTES = 32
export const DOMAINS_AUTH_VERIFIER_HEX_LENGTH = DOMAINS_AUTH_VERIFIER_BYTES * 2

const HEX_64_RE = /^[0-9a-f]{64}$/

// length-checked timing-safe string comparison; safely returns false for non-strings.
export const safeEqual = (received, expected) => {
  if (typeof received !== 'string' || typeof expected !== 'string') return false
  if (received.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected))
}

export function isValidHex64 (hex) {
  return typeof hex === 'string' && HEX_64_RE.test(hex)
}

export function deriveChallenge (verifier) {
  return createHash('sha256').update(verifier).digest('hex')
}
