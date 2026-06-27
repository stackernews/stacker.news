import { parsePaymentRequest } from 'ln-service'
import { errorMessage } from '@/lib/error'
import { formatMsats, formatSats, msatsToSats, msatsSatsFloor, toPositiveNumber } from '@/lib/format'
import { MIN_RECEIVE_MSATS, WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { timeoutSignal } from '@/lib/time'
import { walletLogger } from '@/wallets/server/logger'
import {
  protocolCreateInvoice,
  protocolReceivableDescription,
  protocolReceivableMsats
} from '@/wallets/server/protocols'

const MAX_PENDING_INVOICES_PER_WALLET = 25

export async function * createBolt11FromWalletProtocols (walletProtocols, { msats, description, descriptionHash, expiry = 360 }, { models, limitPending = true }) {
  msats = toPositiveNumber(msats)
  description ||= ''

  for (const protocol of walletProtocols) {
    // snap the request onto what this provider can actually invoice
    const receivableMsats = protocolReceivableMsats(protocol, msats)
    if (receivableMsats < MIN_RECEIVE_MSATS) continue
    const receivableMsatsNum = Number(receivableMsats)
    // clamp the memo to what this provider accepts
    const receivableDescription = protocolReceivableDescription(protocol, description)

    const logger = walletLogger({ protocolId: protocol.id, userId: protocol.userId, models })

    try {
      logger.info(
        `↙ incoming payment: ${formatSats(msatsToSats(receivableMsatsNum))}`, {
          amount: formatMsats(receivableMsatsNum)
        })

      let bolt11
      let verificationContext
      try {
        if (limitPending) {
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
            logger.warn(`too many pending invoices: has ${pendingPayOutBolt11Count}, max ${MAX_PENDING_INVOICES_PER_WALLET}`, { updateStatus: true })
            continue
          }
        }

        const result = await protocolCreateInvoice(
          protocol,
          { msats: receivableMsatsNum, description: receivableDescription, descriptionHash, expiry },
          protocol.config,
          { signal: timeoutSignal(WALLET_CREATE_INVOICE_TIMEOUT_MS) })
        bolt11 = result.bolt11
        verificationContext = result.verificationContext
      } catch (err) {
        throw new Error('failed to create invoice: ' + errorMessage(err))
      }

      const invoice = await parsePaymentRequest({ request: bolt11 })

      // Reject only over-minting or a shortfall larger than the sub-sat remainder
      const invoiceMsats = BigInt(invoice.mtokens)
      const minInvoiceMsats = msatsSatsFloor(receivableMsats)
      if (invoiceMsats > receivableMsats || invoiceMsats < minInvoiceMsats) {
        throw new Error(`invoice invalid: provider minted ${invoiceMsats} msats, expected ${minInvoiceMsats} to ${receivableMsats}`)
      }

      logger.ok(`created invoice for ${formatSats(msatsToSats(invoice.mtokens))}`, {
        bolt11,
        updateStatus: true
      })

      yield { bolt11, invoice, protocol, logger, verificationContext }
    } catch (err) {
      console.error('failed to create user invoice:', err)
      logger.error(errorMessage(err), { updateStatus: true })
    }
  }
}
