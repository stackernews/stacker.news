import { formatMsats } from '@/lib/format'
import { parsePaymentRequest } from 'ln-service'

export function walletLogger ({
  models,
  protocolId,
  userId,
  payInId
}) {
  // server implementation of wallet logger interface on client
  const log = (level) => async (message, context = {}) => {
    // if no timestamp is given, set createdAt to time when logger was called to keep logs in order
    // since logs are created asynchronously and thus might get inserted out of order
    // however, millisecond precision is not always enough ...
    const createdAt = context?.createdAt ?? new Date()
    delete context?.createdAt

    const updateStatus = protocolId && ['OK', 'ERROR', 'WARNING'].includes(level) && (payInId || context.bolt11 || context?.updateStatus)
    delete context?.updateStatus

    try {
      if (context.bolt11) {
        // automatically populate context from bolt11 to avoid duplicating this code
        // (this is needed because in some cases we want to log before we have an invoice or withdrawal id)
        context = {
          ...context,
          ...await logContextFromBolt11(context.bolt11)
        }
      }

      await models.$transaction([
        models.walletLog.create({
          data: {
            userId,
            protocolId,
            level,
            message,
            context,
            payInId,
            createdAt
          }
        }),
        updateStatus && models.walletProtocol.update({
          where: { id: protocolId },
          data: { status: level }
        })
      ].filter(Boolean))
    } catch (err) {
      console.error('error creating wallet log:', err)
    }
  }

  return {
    ok: (message, context) => log('OK')(message, context),
    info: (message, context) => log('INFO')(message, context),
    error: (message, context) => log('ERROR')(message, context),
    warn: (message, context) => log('WARNING')(message, context),
    debug: (message, context) => log('DEBUG')(message, context)
  }
}

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
