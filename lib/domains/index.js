import { cachedFetcher } from '@/lib/fetch'
import prisma from '@/api/models'
import {
  CUSTOM_DOMAINS_DEBUG,
  CUSTOM_DOMAINS_CACHE_EXPIRY_MS,
  CUSTOM_DOMAINS_CACHE_FORCE_REFRESH_THRESHOLD_MS
} from '@/lib/constants'
import { parseSafeHost } from '@/lib/safe-url'
import { getSeoWithFallback } from '@/lib/domains/seo'

// main domain
export const SN_MAIN_DOMAIN = new URL(process.env.NEXT_PUBLIC_URL)

export const domainsMappingsCache = cachedFetcher(async function fetchDomainsMappings () {
  try {
    const domains = await prisma.domain.findMany({
      select: {
        id: true, // pins JWTs to a specific Domain row across delete/recreate cycles
        domainName: true,
        subName: true,
        tokenVersion: true, // jwt revocability within a single row lifetime
        sub: {
          select: {
            desc: true,
            seo: {
              select: {
                title: true,
                tagline: true,
                faviconId: true
              }
            },
            theme: {
              select: {
                primaryColor: true,
                secondaryColor: true,
                linkColor: true,
                logoId: true
              }
            }
          }
        }
      },
      where: {
        status: 'ACTIVE'
      }
    })

    if (!domains.length) return null

    return domains.reduce((acc, domain) => {
      acc[domain.domainName.toLowerCase()] = {
        id: domain.id,
        domainName: domain.domainName,
        subName: domain.subName,
        subDesc: domain.sub?.desc ?? null,
        subTheme: domain.sub?.theme ?? null,
        subSeo: domain.sub?.seo ?? null,
        tokenVersion: domain.tokenVersion
      }
      return acc
    }, {})
  } catch (error) {
    console.error('[domains] error fetching domain mappings', error)
    return null
  }
}, {
  forceRefreshThreshold: CUSTOM_DOMAINS_CACHE_FORCE_REFRESH_THRESHOLD_MS,
  cacheExpiry: CUSTOM_DOMAINS_CACHE_EXPIRY_MS,
  debug: CUSTOM_DOMAINS_DEBUG,
  keyGenerator: () => 'domain_mappings'
})

/** returns all custom domain data for a given domain
 * with this shape: { id, domainName, subName, subDesc, subTheme, subSeo, tokenVersion } */
export const getDomainMapping = async (domain) => {
  const parsedDomain = parseSafeHost(domain)
  if (!parsedDomain) return null

  const domainsMappings = await domainsMappingsCache()
  return domainsMappings?.[parsedDomain.hostname] ?? null
}

/** returns domain branding with this shape: { theme, seo } */
export const getDomainBranding = async (domain) => {
  const domainMapping = await getDomainMapping(domain)
  if (!domainMapping) return null

  const theme = domainMapping.subTheme
  const seo = getSeoWithFallback(domainMapping)
  return { theme, seo }
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
