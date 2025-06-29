import { getSession } from 'next-auth/react'
import prisma from '@/api/models'

export default async function handler (req, res) {
  const session = await getSession({ req })

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      const grants = await prisma.oAuthAuthorizationGrant.findMany({
        where: {
          userId: session.user.id,
          revokedAt: null
        },
        include: {
          application: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      return res.status(200).json(grants)
    } catch (error) {
      console.error(error)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  } else if (req.method === 'DELETE') {
    const { id } = req.query

    if (!id) {
      return res.status(400).json({ error: 'Grant ID is required' })
    }

    try {
      await prisma.oAuthAuthorizationGrant.updateMany({
        where: {
          id: String(id),
          userId: session.user.id
        },
        data: {
          revokedAt: new Date()
        }
      })
      return res.status(204).end()
    } catch (error) {
      console.error(error)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}
