import { parsePaymentRequest } from 'ln-service'
import { formatMsats, formatSats, msatsToSats, toPositiveNumber } from '@/lib/format'
import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { timeoutSignal, withTimeout } from '@/lib/time'
import { walletLogger } from '@/wallets/server/logger'
import { protocolCreateInvoice } from '@/wallets/server/protocols'

const MAX_PENDING_INVOICES_PER_WALLET = 25

export async function * createBolt11FromWalletProtocols (walletProtocols, { msats, description, descriptionHash, expiry = 360 }, { models }) {
  msats = toPositiveNumber(msats)

  for (const protocol of walletProtocols) {
    const logger = walletLogger({ protocolId: protocol.id, userId: protocol.userId, models })

    try {
      logger.info(
        `↙ incoming payment: ${formatSats(msatsToSats(msats))}`, {
          amount: formatMsats(msats)
        })
        .catch(err => console.error('failed to write incoming payment wallet log:', err))

      let bolt11
      try {
        bolt11 = await _protocolCreateInvoice(
          protocol,
          { msats, description, descriptionHash, expiry },
          { models })
      } catch (err) {
        throw new Error('failed to create invoice: ' + err.message)
      }

      const invoice = await parsePaymentRequest({ request: bolt11 })

      logger.info(`created invoice for ${formatSats(msatsToSats(invoice.mtokens))}`, {
        bolt11
      })
        .catch(err => console.error('failed to write created invoice wallet log:', err))

      if (BigInt(invoice.mtokens) !== BigInt(msats)) {
        if (BigInt(invoice.mtokens) > BigInt(msats)) {
          throw new Error('invoice invalid: amount too big')
        }
        if (BigInt(invoice.mtokens) === 0n) {
          throw new Error('invoice invalid: amount is 0 msats')
        }
        if (BigInt(msats) - BigInt(invoice.mtokens) >= 1000n) {
          throw new Error('invoice invalid: amount too small')
        }
      }

      yield { bolt11, protocol, logger }
    } catch (err) {
      console.error('failed to create user invoice:', err)
      logger.error(err.message, { updateStatus: true })
        .catch(logErr => console.error('failed to write invoice failure wallet log:', logErr))
    }
  }
}

async function _protocolCreateInvoice (protocol, {
  msats,
  description,
  descriptionHash,
  expiry = 360
}, { logger, models }) {
  // check for pending payouts
  const pendingPayOutBolt11Count = await models.payOutBolt11.count({
    where: {
      protocolId: protocol.id,
      status: null,
      payIn: {
        payInState: { notIn: ['PAID', 'FAILED'] }
      }
    }
  })

  if (pendingPayOutBolt11Count >= MAX_PENDING_INVOICES_PER_WALLET) {
    throw new Error(`too many pending invoices: has ${pendingPayOutBolt11Count}, max ${MAX_PENDING_INVOICES_PER_WALLET}`)
  }

  return await withTimeout(
    protocolCreateInvoice(
      protocol,
      {
        msats,
        description,
        descriptionHash,
        expiry
      },
      protocol.config,
      {
        logger,
        signal: timeoutSignal(WALLET_CREATE_INVOICE_TIMEOUT_MS)
      }
    ), WALLET_CREATE_INVOICE_TIMEOUT_MS)
}
