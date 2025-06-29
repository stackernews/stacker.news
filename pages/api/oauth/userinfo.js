import { authenticateOAuth } from '../../../lib/oauth-auth'
import models from '../../../api/models'

export default async function handler (req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = await authenticateOAuth(req, ['read', 'profile:read'])
    if (!auth.success) {
      return res.status(401).json({ error: auth.error })
    }

    const { user } = auth

    // Fetch user details from the database
    const userDetails = await models.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        photoId: true
      }
    })

    if (!userDetails) {
      return res.status(404).json({ error: 'User not found' })
    }

    return res.status(200).json({
      id: userDetails.id,
      name: userDetails.name,
      created_at: userDetails.createdAt.toISOString(),
      photo_id: userDetails.photoId
    })
  } catch (error) {
    console.error('Error in OAuth userinfo endpoint:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
