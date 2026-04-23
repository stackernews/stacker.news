import { cachedFetcher } from '@/lib/fetch'
import prisma from '@/api/models'
import { CUSTOM_DOMAINS_DEBUG } from '@/lib/constants'

// main domain
export const SN_MAIN_DOMAIN = new URL(process.env.NEXT_PUBLIC_URL)

export const domainsMappingsCache = cachedFetcher(async function fetchDomainsMappings () {
  try {
    const domains = await prisma.domain.findMany({
      select: {
        id: true,
        domainName: true,
        subName: true,
        tokenVersion: true
      },
      where: {
        status: 'ACTIVE'
      }
    })

    if (!domains.length) return null

    return domains.reduce((acc, domain) => {
      acc[domain.domainName.toLowerCase()] = {
        id: domain.id, // pins JWTs to a specific Domain row across delete/recreate cycles
        domainName: domain.domainName,
        subName: domain.subName,
        tokenVersion: domain.tokenVersion // jwt revocability within a single row lifetime
      }
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
  // handles both NextRequest and Node request
  const host = req.headers.host ?? req.headers.get('host')
  if (!host) return null

  const normalized = process.env.NODE_ENV === 'development' ? host.split(':')[0] : host
  const mapping = normalized && normalized !== SN_MAIN_DOMAIN.hostname
    ? await getDomainMapping(normalized)
    : null

  return mapping
}
