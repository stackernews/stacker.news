import { formatMsats } from '@/lib/format'
import { parsePaymentRequest } from 'ln-service'

// TODO(wallet-v2): update this for wallet schema v2
export function walletLogger ({ wallet, models, me }) {
  // no-op logger if no wallet or user provided
  if (!wallet && !me) {
    return {
      ok: () => {},
      info: () => {},
      error: () => {},
      warn: () => {}
    }
  }

  // server implementation of wallet logger interface on client
  const log = (level) => async (message, ctx = {}) => {
    try {
      let { invoiceId, withdrawalId, ...context } = ctx

      if (context.bolt11) {
        // automatically populate context from bolt11 to avoid duplicating this code
        context = {
          ...context,
          ...await logContextFromBolt11(context.bolt11)
        }
      }

      await models.walletLog.create({
        data: {
          userId: wallet?.userId ?? me.id,
          // system logs have no wallet
          wallet: wallet?.type,
          level,
          message,
          context,
          invoiceId,
          withdrawalId
        }
      })
    } catch (err) {
      console.error('error creating wallet log:', err)
    }
  }

  return {
    ok: (message, context) => log('SUCCESS')(message, context),
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
