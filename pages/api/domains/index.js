import prisma from '@/api/models'

// API Endpoint for getting all VERIFIED custom domains, used by a cachedFetcher
export default async function handler (req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // fetch all VERIFIED custom domains from the database
    const domains = await prisma.domain.findMany({
      select: {
        domainName: true,
        subName: true
      },
      where: {
        status: 'ACTIVE'
      }
    })

    // map domains to a key-value pair
    const domainMappings = domains.reduce((acc, domain) => {
      acc[domain.domainName.toLowerCase()] = {
        subName: domain.subName
      }
      return acc
    }, {})

    return res.status(200).json(domainMappings)
  } catch (error) {
    console.error('cannot fetch domains:', error)
    return res.status(500).json({ error: 'Failed to fetch domains' })
  }
}
