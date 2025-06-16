import { formatMsats } from '@/lib/format'
import { parsePaymentRequest } from 'ln-service'

export function walletLogger ({
  models,
  protocolId,
  userId,
  invoiceId,
  withdrawalId
}) {
  // server implementation of wallet logger interface on client
  const log = (level) => async (message, context = {}) => {
    // set createdAt to time when logger was called to keep logs in order
    // since logs are created asynchronously and thus might get inserted out of order
    // however, millisecond precision is not always enough ...
    const createdAt = new Date()

    try {
      if (context.bolt11) {
        // automatically populate context from bolt11 to avoid duplicating this code
        context = {
          ...context,
          ...await logContextFromBolt11(context.bolt11)
        }
      }

      await models.walletLog.create({
        data: {
          userId,
          protocolId,
          level,
          message,
          context,
          invoiceId,
          withdrawalId,
          createdAt
        }
      })
    } catch (err) {
      console.error('error creating wallet log:', err)
    }
  }

  return {
    ok: (message, context) => log('OK')(message, context),
    info: (message, context) => log('INFO')(message, context),
    error: (message, context) => log('ERROR')(message, context),
    warn: (message, context) => log('WARN')(message, context)
  }
}

// TODO(wallet-v2): still needed?
export async function logContextFromBolt11 (bolt11) {
  const decoded = await parsePaymentRequest({ request: bolt11 })
  return {
    bolt11,
    amount: formatMsats(decoded.mtokens),
    payment_hash: decoded.id,
    created_at: decoded.created_at,
    expires_at: decoded.expires_at,
    description: decoded.description
  }
}
