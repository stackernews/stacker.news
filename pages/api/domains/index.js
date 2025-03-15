import prisma from '@/api/models'

// TODO: Authentication for this?
export default async function handler (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // fetch all custom domains from the database
    const domains = await prisma.customDomain.findMany({
      select: {
        domain: true,
        subName: true
      },
      where: {
        dnsState: 'VERIFIED',
        sslState: 'VERIFIED'
      }
    })

    // map domains to a key-value pair
    const domainMappings = domains.reduce((acc, domain) => {
      acc[domain.domain.toLowerCase()] = {
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
