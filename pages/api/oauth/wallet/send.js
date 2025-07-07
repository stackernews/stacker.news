import { authenticateOAuth } from '../../../../lib/oauth-auth'
import models from '../../../../api/models'
import { parsePaymentRequest } from 'ln-service'
import { createWithdrawal } from '../../../../api/resolvers/wallet'
import lnd from '../../../../api/lnd'

export default async function handler (req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = await authenticateOAuth(req, ['wallet:send'])
    if (!auth.success) {
      return res.status(401).json({ error: auth.error })
    }

    const { user, accessToken } = auth
    const { bolt11, max_fee_sats: maxFeeSats } = req.body

    if (!bolt11) {
      return res.status(400).json({ error: 'bolt11 payment request is required' })
    }

    // Parse and validate the payment request
    let parsedPaymentRequest
    try {
      parsedPaymentRequest = parsePaymentRequest({ request: bolt11 })
    } catch (error) {
      console.error('Error parsing payment request:', error)
      return res.status(400).json({ error: `Invalid payment request: ${error.message || 'unknown error'}` })
    }

    const amountMsats = BigInt(parsedPaymentRequest.mtokens || 0)

    if (amountMsats <= 0) {
      return res.status(400).json({ error: 'Payment request must have a valid amount' })
    }

    // Security limits for OAuth payments
    const maxPaymentMsats = BigInt('1000000000') // 1M sats
    if (amountMsats > maxPaymentMsats) {
      return res.status(400).json({
        error: 'Payment amount exceeds maximum allowed for OAuth applications',
        max_amount_msats: maxPaymentMsats.toString()
      })
    }

    // Check if user has sufficient balance
    const userRecord = await models.user.findUnique({
      where: { id: user.id },
      select: { msats: true }
    })

    if (!userRecord || userRecord.msats < amountMsats) {
      return res.status(400).json({ error: 'Insufficient balance' })
    }

    // Create a payment request that requires user approval
    const paymentRequest = await models.oAuthWalletTransaction.create({
      data: {
        userId: user.id,
        applicationId: accessToken.applicationId,
        accessTokenId: accessToken.id,
        bolt11,
        amountMsats,
        description: parsedPaymentRequest.description || 'OAuth app payment',
        metadata: {
          destination: parsedPaymentRequest.destination,
          max_fee_sats: maxFeeSats?.toString() || null,
          expires_at: parsedPaymentRequest.expires_at
        },
        status: 'pending_approval',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes to approve
      }
    })

    // For small amounts, we might auto-approve (security consideration)
    const autoApproveThreshold = BigInt('100000') // 100 sats in msats

    if (amountMsats <= autoApproveThreshold) {
      // In a real implementation, this would actually send the payment
      let withdrawal
      try {
        withdrawal = await createWithdrawal(null, { invoice: bolt11, maxFee: maxFeeSats ? Number(maxFeeSats) : undefined }, { me: user, models, lnd })
      } catch (error) {
        if (error.message.includes('insufficient funds')) {
          return res.status(400).json({ error: 'Insufficient balance to cover payment and max fee' })
        }
        // Re-throw other errors
        throw error
      }

      await models.oAuthWalletTransaction.update({
        where: { id: paymentRequest.id },
        data: {
          status: 'approved',
          approved: true,
          approvedAt: new Date(),
          withdrawalId: withdrawal.id
        }
      })

      return res.status(200).json({
        status: 'OK',
        approved: true,
        payment_request_id: paymentRequest.id
      })
    }

    return res.status(200).json({
      status: 'OK',
      approved: false,
      message: 'Payment requires user approval',
      payment_request_id: paymentRequest.id
    })
  } catch (error) {
    console.error('Error in OAuth wallet send:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
