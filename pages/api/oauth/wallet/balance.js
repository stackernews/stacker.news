import { authenticateOAuth } from '../../../../lib/oauth-auth'
import models from '../../../../api/models'

export default async function handler (req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = await authenticateOAuth(req, ['wallet:read'])
    if (!auth.success) {
      return res.status(401).json({ error: auth.error })
    }

    const { user } = auth

    // Get user's current balance
    const userRecord = await models.user.findUnique({
      where: { id: user.id },
      select: {
        msats: true,
        stackedMsats: true
      }
    })

    if (!userRecord) {
      return res.status(404).json({ error: 'User not found' })
    }

    const response = {
      balance_msats: userRecord.msats.toString(),
      balance_sats: Math.floor(Number(userRecord.msats) / 1000),
      stacked_msats: userRecord.stackedMsats.toString(),
      stacked_sats: Math.floor(Number(userRecord.stackedMsats) / 1000)
    }

    return res.status(200).json(response)
  } catch (error) {
    console.error('Error in OAuth wallet balance:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
