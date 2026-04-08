import { cachedFetcher } from '@/lib/fetch'
import prisma from '@/api/models'

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
  forceRefreshThreshold: 1000 * 60 * 2, // 2 minutes before cache expiry
  cacheExpiry: 1000 * 60 * 5, // 5 minutes cache expiry
  debug: true, // TEST
  keyGenerator: () => 'domain_mappings'
})

export const getDomainMapping = async (domain) => {
  const domainsMappings = await domainsMappingsCache()
  return domainsMappings?.[domain?.toLowerCase()]
}
