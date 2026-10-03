import { createHash, timingSafeEqual } from 'node:crypto'

// The capture service can't reach the DB, so it mirrors domainsMappingsCache over HTTP.
// Everything here is about handing it the least we can: the bare hostnames it needs to
// tell "a page of ours" from "any site on the internet", and nothing else off the mapping.

const BEARER = /^Bearer[ \t]+(.+)$/i

/** @param {object|null} mappings - domainsMappingsCache() output @returns {string[]} */
export function buildAllowlist (mappings) {
  if (!mappings) return []

  return Object.keys(mappings)
    .filter(domainName => typeof domainName === 'string' && domainName.length > 0)
    .map(domainName => domainName.toLowerCase())
    .sort()
}

/**
 * Constant-time bearer check. Both sides are hashed first so the comparison is over
 * fixed-length buffers: timingSafeEqual throws on a length mismatch, and comparing
 * lengths up front would leak the secret's length.
 */
export function isAuthorizedCaptureRequest (authorization, secret) {
  // an unset CAPTURE_DOMAINS_SECRET must deny everything, never authorize everything
  if (typeof secret !== 'string' || !secret) return false
  if (typeof authorization !== 'string') return false

  const presented = BEARER.exec(authorization)?.[1]
  if (!presented) return false

  return timingSafeEqual(sha256(presented), sha256(secret))
}

const sha256 = value => createHash('sha256').update(value).digest()
