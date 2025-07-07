import { getSession } from 'next-auth/react'
import prisma from '@/api/models'
import { SN_ADMIN_IDS } from '@/lib/constants'

export default async function handler (req, res) {
  const session = await getSession({ req })

  if (!session || !SN_ADMIN_IDS.includes(session.user.id)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      const applications = await prisma.oAuthApplication.findMany({
        where: {
          approved: false
        },
        orderBy: {
          createdAt: 'asc'
        }
      })
      return res.status(200).json(applications)
    } catch (error) {
      console.error(error)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  } else {
    res.setHeader('Allow', ['GET'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}
