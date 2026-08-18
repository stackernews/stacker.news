import { decodePaymentRequest } from '@/api/lnd'
import { createHash } from 'crypto'
import { errorMessage, GqlInputError } from '@/lib/error'
import { formatMsats, formatSats, msatsToSats, msatsSatsFloor, toPositiveNumber } from '@/lib/format'
import { WALLET_MAX_PENDING_EXTERNAL_RECEIVES, WALLET_MAX_PENDING_PAYOUT_INVOICES, MIN_RECEIVE_MSATS, WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { withTimeoutSignal } from '@/lib/time'
import { walletLogger } from '@/wallets/server/logger'
import { createExternalReceiveTransaction } from '@/wallets/server/external-transactions'
import {
  protocolCreateInvoice,
  protocolReceivableDescription,
  protocolReceivableMsats,
  protocolSupportsDescriptionHash
} from '@/wallets/server/protocols'

export async function * createBolt11FromWalletProtocols (walletProtocols, {
  msats,
  description,
  descriptionHash,
  descriptionHashPreimage,
  requireDescriptionHash = false,
  expiry = 360
}, { models, userId, limitPending = true }) {
  msats = toPositiveNumber(msats)
  const user = await models.user.findUnique({
    where: { id: userId },
    select: { hideInvoiceDesc: true }
  })
  if (!user) throw new GqlInputError('user not found')
  description = user.hideInvoiceDesc ? '' : description || ''

  if (requireDescriptionHash) {
    const expectedDescriptionHash = typeof descriptionHashPreimage === 'string'
      ? createHash('sha256').update(descriptionHashPreimage).digest('hex')
      : undefined
    if (typeof descriptionHash !== 'string' || expectedDescriptionHash !== descriptionHash.toLowerCase()) {
      throw new Error('description hash does not match its preimage')
    }
  }

  for (const protocol of walletProtocols) {
    if (requireDescriptionHash && !protocolSupportsDescriptionHash(protocol)) continue

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
      let lnurlVerifyUrl
      let providerRequestId
      try {
        if (limitPending) {
          const pendingPayOutBolt11Count = await models.payOutBolt11.count({
            where: {
              protocolId: protocol.id,
              status: null,
              payIn: {
                payInState: { notIn: ['PAID', 'FAILED'] }
              }
            }
          })

          if (pendingPayOutBolt11Count >= WALLET_MAX_PENDING_PAYOUT_INVOICES) {
            logger.warn(`too many pending invoices: has ${pendingPayOutBolt11Count}, max ${WALLET_MAX_PENDING_PAYOUT_INVOICES}`, { updateStatus: true })
            continue
          }
        }

        const result = await withTimeoutSignal(WALLET_CREATE_INVOICE_TIMEOUT_MS, signal =>
          protocolCreateInvoice(
            protocol,
            {
              msats: receivableMsatsNum,
              description: receivableDescription,
              descriptionHash,
              descriptionHashPreimage,
              expiry
            },
            protocol.config,
            { signal }))
        bolt11 = result.bolt11
        lnurlVerifyUrl = result.lnurlVerifyUrl
        providerRequestId = result.providerRequestId
      } catch (err) {
        throw new Error('failed to create invoice: ' + errorMessage(err))
      }

      // Use LND's view for every invoice SN stores or hands to a customer.
      const invoice = await decodePaymentRequest({ request: bolt11 })
      if (!invoice.id) throw new Error('wallet returned invoice without payment hash')
      const invoiceExpiresAt = new Date(invoice.expires_at)
      if (Number.isNaN(invoiceExpiresAt.getTime()) || invoiceExpiresAt <= new Date()) {
        throw new Error('wallet returned invoice without a valid future expiry')
      }

      // Reject only over-minting or a shortfall larger than the sub-sat remainder
      const invoiceMsats = BigInt(invoice.mtokens)
      const minInvoiceMsats = msatsSatsFloor(receivableMsats)
      if (invoiceMsats > receivableMsats || invoiceMsats < minInvoiceMsats) {
        throw new Error(`invoice invalid: provider minted ${invoiceMsats} msats, expected ${minInvoiceMsats} to ${receivableMsats}`)
      }
      if (requireDescriptionHash && invoice.description_hash?.toLowerCase() !== descriptionHash.toLowerCase()) {
        throw new Error('wallet returned invoice with an incorrect description hash')
      }

      logger.ok(`created invoice for ${formatSats(msatsToSats(invoice.mtokens))}`, {
        bolt11,
        updateStatus: true
      })

      yield { bolt11, invoice, protocol, logger, lnurlVerifyUrl, providerRequestId }
    } catch (err) {
      console.error('failed to create user invoice:', err)
      logger.error(errorMessage(err), { updateStatus: true })
    }
  }
}

export async function createExternalReceiveInvoice (models, {
  userId,
  walletId,
  msats,
  description,
  descriptionHash,
  descriptionHashPreimage,
  requireDescriptionHash,
  expiry,
  sourceType,
  sourceValue,
  comment,
  lud18Data,
  note
}) {
  if (note && typeof descriptionHashPreimage !== 'string') {
    throw new GqlInputError('NIP-57 request is missing its description hash preimage')
  }

  const now = new Date()
  const recentUnpaidReceives = await models.externalTransaction.count({
    where: {
      userId,
      direction: 'RECEIVE',
      createdAt: { gt: new Date(now.getTime() - 60 * 60_000) },
      invoiceExpiresAt: { gt: now },
      OR: [
        { outcome: null },
        { outcome: 'UNKNOWN' }
      ]
    }
  })
  if (recentUnpaidReceives >= WALLET_MAX_PENDING_EXTERNAL_RECEIVES) {
    throw new GqlInputError('too many unpaid invoices created recently; try again later')
  }

  const protocols = await models.walletProtocol.findMany({
    where: {
      send: false,
      enabled: true,
      wallet: {
        userId,
        ...(walletId != null && { id: Number(walletId) })
      }
    },
    orderBy: [
      { wallet: { priority: 'asc' } },
      { id: 'asc' }
    ]
  })

  if (protocols.length === 0) {
    throw new GqlInputError(walletId == null ? 'no wallet can receive' : 'wallet cannot receive')
  }

  const invoices = createBolt11FromWalletProtocols(
    protocols.map(protocol => ({ ...protocol, userId })),
    { msats, description, descriptionHash, descriptionHashPreimage, requireDescriptionHash, expiry },
    { models, userId, limitPending: false }
  )
  const { value } = await invoices.next()
  if (!value) throw new GqlInputError('wallet could not create a receive invoice')

  const transaction = await createExternalReceiveTransaction(models, {
    userId,
    protocol: value.protocol,
    bolt11: value.bolt11,
    invoice: value.invoice,
    lnurlVerifyUrl: value.lnurlVerifyUrl,
    providerRequestId: value.providerRequestId,
    sourceType,
    sourceValue,
    comment,
    descriptionHashPreimage,
    lud18Data,
    note
  })

  return { ...value, transaction }
}
