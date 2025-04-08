import { cachedFetcher } from '@/lib/fetch'

export const domainLogger = () => {
  if (process.env.DOMAIN_DEBUG === 'true') {
    return {
      log: (message, ...args) => {
        console.log(message, ...args)
      },
      error: (message, ...args) => {
        console.error(message, ...args)
      }
    }
  }
}

// fetch custom domain mappings from our API, caching it for 5 minutes
export const getDomainMappingsCache = cachedFetcher(async function fetchDomainMappings () {
  const url = `${process.env.NEXT_PUBLIC_URL}/api/domains`
  domainLogger().log('fetching domain mappings from', url) // TEST
  try {
    const response = await fetch(url)
    if (!response.ok) {
      domainLogger().error(`Cannot fetch domain mappings: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()
    return Object.keys(data).length > 0 ? data : null
  } catch (error) {
    domainLogger().error('Cannot fetch domain mappings:', error)
    return null
  }
}, {
  cacheExpiry: 300000, // 5 minutes cache
  forceRefreshThreshold: 600000, // 10 minutes before force refresh
  keyGenerator: () => 'domain_mappings'
})
