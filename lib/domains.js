import { cachedFetcher } from '@/lib/fetch'

export const domainsMappingsCache = cachedFetcher(async function fetchDomainsMappings () {
  const url = `${process.env.NEXT_PUBLIC_URL}/api/domains`
  console.log('[domains] cache miss, fetching domain mappings from', url) // TEST
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.log('[domains] error fetching domain mappings', response.statusText) // TEST
      return null
    }

    const data = await response.json()
    return Object.keys(data).length > 0 ? data : null
  } catch (error) {
    console.error('[domains] error fetching domain mappings', error) // TEST
    return null
  }
}, {
  cacheExpiry: 1000 * 60 * 5, // 5 minutes cache
  forceRefreshThreshold: 1000 * 60 * 10, // 10 minutes before cache expiry
  keyGenerator: () => 'domain_mappings'
})

export const getDomainMapping = async (domain) => {
  const domainsMappings = await domainsMappingsCache()
  return domainsMappings?.[domain?.toLowerCase()]
}
