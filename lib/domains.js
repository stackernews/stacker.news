import { cachedFetcher } from '@/lib/fetch'
import prisma from '@/api/models'
import { CUSTOM_DOMAINS_DEBUG } from '@/lib/constants'

// main domain
export const SN_MAIN_DOMAIN = new URL(process.env.NEXT_PUBLIC_URL)

export const domainsMappingsCache = cachedFetcher(async function fetchDomainsMappings () {
  try {
    const domains = await prisma.domain.findMany({
      select: {
        domainName: true,
        subName: true
      },
      where: {
        status: 'ACTIVE'
      }
    })

    if (!domains.length) return null

    return domains.reduce((acc, domain) => {
      acc[domain.domainName.toLowerCase()] = { subName: domain.subName }
      return acc
    }, {})
  } catch (error) {
    console.error('[domains] error fetching domain mappings', error)
    return null
  }
}, {
  forceRefreshThreshold: 1000 * 60 * 5,
  cacheExpiry: 1000 * 60 * 2,
  debug: CUSTOM_DOMAINS_DEBUG,
  keyGenerator: () => 'domain_mappings'
})

export const getDomainMapping = async (domain) => {
  const domainsMappings = await domainsMappingsCache()
  return domainsMappings?.[domain?.toLowerCase()]
}

export function createDomainsDebugLogger (domainName, debug = CUSTOM_DOMAINS_DEBUG) {
  const noop = () => {}

  if (!debug) {
    return {
      log: noop,
      errorLog: noop
    }
  }

  const log = (message, ...args) => console.log(`[DOMAINS:${domainName}] ${message}`, ...args)
  const errorLog = (message, ...args) => console.error(`[DOMAINS:${domainName}] ${message}`, ...args)

  return {
    log,
    errorLog
  }
}

export async function getDomainMappingFromRequest (req) {
  const host = req.headers.get('host')
  const normalized = process.env.NODE_ENV === 'development' ? host.split(':')[0] : host
  const mapping = normalized && normalized !== SN_MAIN_DOMAIN.host
    ? await getDomainMapping(normalized)
    : null

  return mapping
}
