import { authenticateOAuth } from '../../../../lib/oauth-auth'
import models from '../../../../api/models'
import { InvoiceActionType } from '@prisma/client'

export default async function handler (req, res) {
  if (req.method === 'GET') {
    return await getInvoices(req, res)
  } else if (req.method === 'POST') {
    return await createInvoice(req, res)
  } else {
    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }
}

async function getInvoices (req, res) {
  try {
    const auth = await authenticateOAuth(req, ['wallet:read'])
    if (!auth.success) {
      return res.status(401).json({ error: auth.error })
    }

    const { user } = auth
    const { limit = 50, offset = 0, status } = req.query

    const where = {
      userId: user.id
    }

    if (status) {
      if (status === 'paid') {
        where.confirmedAt = { not: null }
      } else if (status === 'pending') {
        where.confirmedAt = null
        where.expiresAt = { gt: new Date() }
        where.cancelled = false
      } else if (status === 'expired') {
        where.confirmedAt = null
        where.expiresAt = { lte: new Date() }
        where.cancelled = false
      } else if (status === 'cancelled') {
        where.cancelled = true
      }
    }

    const invoices = await models.invoice.findMany({
      where,
      select: {
        id: true,
        hash: true,
        bolt11: true,
        msatsRequested: true,
        msatsReceived: true,
        desc: true,
        confirmedAt: true,
        expiresAt: true,
        cancelled: true,
        createdAt: true,
        actionType: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: Math.min(parseInt(limit), 100),
      skip: parseInt(offset)
    })

    const transformedInvoices = invoices.map(invoice => ({
      id: invoice.id,
      hash: invoice.hash,
      bolt11: invoice.bolt11,
      amount_requested_msats: invoice.msatsRequested.toString(),
      amount_requested_sats: Math.floor(Number(invoice.msatsRequested) / 1000),
      amount_received_msats: invoice.msatsReceived?.toString() || null,
      amount_received_sats: invoice.msatsReceived ? Math.floor(Number(invoice.msatsReceived) / 1000) : null,
      description: invoice.desc,
      status: getInvoiceStatus(invoice),
      confirmed_at: invoice.confirmedAt?.toISOString() || null,
      expires_at: invoice.expiresAt.toISOString(),
      created_at: invoice.createdAt.toISOString(),
      action_type: invoice.actionType
    }))

    return res.status(200).json({
      invoices: transformedInvoices,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: invoices.length === parseInt(limit)
      }
    })
  } catch (error) {
    console.error('Error in OAuth wallet invoices GET:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function createInvoice (req, res) {
  try {
    const auth = await authenticateOAuth(req, ['wallet:receive'])
    if (!auth.success) {
      return res.status(401).json({ error: auth.error })
    }

    const { user, accessToken } = auth
    const { amount_msats: amountMsats, amount_sats: amountSats, description, expiry_seconds: expirySeconds = 3600 } = req.body

    let requestedAmountMsats
    if (amountMsats) {
      requestedAmountMsats = BigInt(amountMsats)
    } else if (amountSats) {
      requestedAmountMsats = BigInt(amountSats) * BigInt(1000)
    } else {
      return res.status(400).json({ error: 'Either amount_msats or amount_sats is required' })
    }

    if (requestedAmountMsats <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' })
    }

    if (requestedAmountMsats > BigInt('100000000000')) { // 100M sats
      return res.status(400).json({ error: 'Amount too large' })
    }

    const expiresAt = new Date(Date.now() + expirySeconds * 1000)

    // Create invoice request for approval
    const invoiceRequest = await models.oAuthWalletInvoiceRequest.create({
      data: {
        userId: user.id,
        applicationId: accessToken.applicationId,
        accessTokenId: accessToken.id,
        bolt11: '', // Will be populated when approved
        amountMsats: requestedAmountMsats,
        description: description || 'Invoice from OAuth app',
        status: 'pending',
        expiresAt
      }
    })

    // For now, we'll auto-approve small amounts (< 10,000 sats)
    // In a production system, larger amounts should require user approval
    const autoApproveThreshold = BigInt('10000000') // 10,000 sats in msats

    if (requestedAmountMsats <= autoApproveThreshold) {
      // Auto-approve and create actual invoice
      const invoice = await models.invoice.create({
        data: {
          userId: user.id,
          msatsRequested: requestedAmountMsats,
          desc: description || 'Invoice via OAuth app',
          actionType: InvoiceActionType.RECEIVE,
          expiresAt,
          // Note: In a real implementation, you'd generate the actual bolt11 here
          // using the user's configured receive wallet
          bolt11: `lnbc${Math.floor(Number(requestedAmountMsats) / 1000)}...` // Placeholder
        }
      })

      await models.oAuthWalletInvoiceRequest.update({
        where: { id: invoiceRequest.id },
        data: {
          status: 'approved',
          approved: true,
          approvedAt: new Date(),
          invoiceId: invoice.id,
          bolt11: invoice.bolt11
        }
      })

      return res.status(201).json({
        id: invoice.id,
        hash: invoice.hash,
        bolt11: invoice.bolt11,
        amount_requested_msats: invoice.msatsRequested.toString(),
        amount_requested_sats: Math.floor(Number(invoice.msatsRequested) / 1000),
        description: invoice.desc,
        status: 'pending',
        expires_at: invoice.expiresAt.toISOString(),
        created_at: invoice.createdAt.toISOString(),
        request_id: invoiceRequest.id
      })
    } else {
      // Requires manual approval
      return res.status(202).json({
        request_id: invoiceRequest.id,
        status: 'pending_approval',
        amount_requested_msats: requestedAmountMsats.toString(),
        amount_requested_sats: Math.floor(Number(requestedAmountMsats) / 1000),
        description: description || 'Invoice from OAuth app',
        expires_at: expiresAt.toISOString(),
        approval_url: `/oauth/approve-invoice/${invoiceRequest.id}`
      })
    }
  } catch (error) {
    console.error('Error in OAuth wallet invoices POST:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

function getInvoiceStatus (invoice) {
  if (invoice.cancelled) return 'cancelled'
  if (invoice.confirmedAt) return 'paid'
  if (new Date() > invoice.expiresAt) return 'expired'
  return 'pending'
}
