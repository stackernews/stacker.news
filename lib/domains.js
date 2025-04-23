import { cachedFetcher } from '@/lib/fetch'
import prisma from '@/api/models'

export const loggerInstance = process.env.CUSTOM_DOMAIN_LOGGER === 'true'
  ? {
      log: (message, ...args) => {
        console.log(message, ...args)
      },
      error: (message, ...args) => {
        console.error(message, ...args)
      }
    }
  : {
      log: () => {},
      error: () => {}
    }

export const domainLogger = () => loggerInstance

// fetch custom domain mappings from database, caching it for 5 minutes
export const getDomainMappingsCache = cachedFetcher(async function fetchDomainMappings () {
  domainLogger().log('fetching domain mappings from database') // TEST
  try {
    // fetch all VERIFIED custom domains from the database
    const domains = await prisma.customDomain.findMany({
      select: {
        domain: true,
        subName: true
      },
      where: {
        status: 'ACTIVE'
      }
    })

    // map domains to a key-value pair
    const domainMappings = domains.reduce((acc, domain) => {
      acc[domain.domain.toLowerCase()] = {
        subName: domain.subName
      }
      return acc
    }, {})

    return domainMappings
  } catch (error) {
    domainLogger().error('cannot fetch domain mappings from db:', error)
    return null
  }
}, {
  cacheExpiry: 300000, // 5 minutes cache
  forceRefreshThreshold: 600000, // 10 minutes before force refresh
  keyGenerator: () => 'domain_mappings'
})
