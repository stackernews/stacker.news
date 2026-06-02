import { formatMsats } from '@/lib/format'
import { parsePaymentRequest } from 'ln-service'

const WALLET_LOG_DESCRIPTION_MAX_LENGTH = 256

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
    const {
      createdAt = new Date(),
      updateStatus: requestedStatusUpdate,
      ...baseContext
    } = context ?? {}

    return writeWalletLog({
      models,
      protocolId,
      userId,
      payInId,
      level,
      message,
      context: baseContext,
      createdAt,
      updateStatus: requestedStatusUpdate
    })
  }

  return {
    ok: (message, context) => log('OK')(message, context),
    info: (message, context) => log('INFO')(message, context),
    error: (message, context) => log('ERROR')(message, context),
    warn: (message, context) => log('WARNING')(message, context)
  }
}

export async function writeWalletLog ({
  models,
  protocolId,
  userId,
  payInId,
  level,
  message,
  context = {},
  createdAt = new Date(),
  updateStatus: requestedStatusUpdate
}) {
  try {
    const shouldUpdateStatus = protocolId != null &&
      ['OK', 'ERROR', 'WARNING'].includes(level) &&
      (context.bolt11 || requestedStatusUpdate)

    const logContext = await walletLogContext(context)

    await models.$transaction([
      models.walletLog.create({
        data: {
          userId,
          protocolId,
          level,
          message,
          context: logContext,
          payInId,
          createdAt
        }
      }),
      shouldUpdateStatus && models.walletProtocol.update({
        where: {
          id: protocolId,
          wallet: {
            userId
          }
        },
        data: { status: level }
      })
    ].filter(Boolean))

    return true
  } catch (err) {
    console.error('error creating wallet log:', err)
    return false
  }
}

async function walletLogContext (context = {}) {
  const { bolt11, ...baseContext } = context
  if (!bolt11) return baseContext

  // Automatically populate context from bolt11 without persisting the full invoice.
  return {
    ...baseContext,
    ...await logContextFromBolt11(bolt11)
  }
}

export async function logContextFromBolt11 (bolt11) {
  const decoded = await parsePaymentRequest({ request: bolt11 })
  return {
    amount: formatMsats(decoded.mtokens),
    payment_hash: decoded.id,
    created_at: decoded.created_at,
    expires_at: decoded.expires_at,
    description: truncate(decoded.description, WALLET_LOG_DESCRIPTION_MAX_LENGTH)
  }
}

function truncate (value, max) {
  if (!value) return ''
  return value.length > max ? value.slice(0, max) : value
}
