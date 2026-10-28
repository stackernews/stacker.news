// Mirror of the app's domainsMappingsCache, reduced to what capture needs: the set of
// ACTIVE custom domain names it is allowed to navigate to. Same stale-while-revalidate
// shape as lib/fetch.js's cachedFetcher, with two differences that suit a public
// screenshot service: failures return null instead of throwing (callers answer 503, so a
// broken allowlist never takes main-domain captures down), and staleness is hard-bounded
// so a revoked domain stops being capturable.

const DEFAULT_TIMEOUT = 5000

export function createDomainsAllowlist ({
  endpoint,
  secret,
  ttl,
  staleTtl,
  fetchImpl = fetch,
  timeout = DEFAULT_TIMEOUT,
  now = Date.now,
  logger = console
}) {
  // { domains: Set<string>, createdAt: number } | null
  let cached = null
  let pending = null

  async function fetchAllowlist () {
    const res = await fetchImpl(endpoint, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(timeout)
    })
    if (!res?.ok) throw new Error(`allowlist endpoint responded ${res?.status}`)

    const body = await res.json()
    if (!body || typeof body !== 'object' || !Array.isArray(body.domains)) {
      throw new Error('allowlist response is malformed')
    }

    const domains = new Set()
    for (const domain of body.domains) {
      if (typeof domain !== 'string' || !domain) throw new Error('allowlist response is malformed')
      domains.add(domain.toLowerCase())
    }
    return domains
  }

  // deduped: a refresh already in flight is shared by every caller, background or not
  function refresh () {
    pending ||= fetchAllowlist()
      .then(domains => {
        cached = { domains, createdAt: now() }
        return domains
      })
      .catch(err => {
        logger.error('[domains] allowlist refresh failed:', err.message)
        return null
      })
      .finally(() => {
        pending = null
      })

    return pending
  }

  return {
    /** @returns {Promise<Set<string>|null>} null when the allowlist can't be trusted */
    async get () {
      if (!secret) return null

      const age = cached ? now() - cached.createdAt : Infinity
      if (age < ttl) return cached.domains
      if (age < staleTtl) {
        // serve the slightly stale set now, catch up out of band
        refresh()
        return cached.domains
      }

      return await refresh()
    }
  }
}
