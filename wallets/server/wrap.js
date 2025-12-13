import { createHodlInvoice, parsePaymentRequest } from 'ln-service'
import lnd, { estimateRouteFeeProbe, getBlockHeight } from '@/api/lnd'
import { toPositiveBigInt, toPositiveNumber } from '@/lib/format'
import { PayInFailureReasonError } from '@/api/payIn/errors'

const MIN_OUTGOING_MSATS = BigInt(700) // the minimum msats we'll allow for the outgoing invoice
const MAX_OUTGOING_MSATS = BigInt(700_000_000) // the maximum msats we'll allow for the outgoing invoice
const MAX_EXPIRATION_INCOMING_MSECS = 600_000 // the maximum expiration time we'll allow for the incoming invoice
const INCOMING_EXPIRATION_BUFFER_MSECS = 120_000 // the buffer enforce for the incoming invoice expiration
const MAX_OUTGOING_CLTV_DELTA = 1000 // the maximum cltv delta we'll allow for the outgoing invoice
export const MIN_SETTLEMENT_CLTV_DELTA = 80 // the minimum blocks we'll leave for settling the incoming invoice
const FEE_ESTIMATE_TIMEOUT_SECS = 5 // the timeout for the fee estimate request
// the buffer in case we underestimated the cltv delta with our probe
// also ln-service enforces a 3 block buffer ontop of the final hop's cltv delta
// preventing outgoing cltv limits that may be exact from being sent
const CLTV_DELTA_BUFFER = 10

/*
  The wrapInvoice function is used to wrap an outgoing invoice with the necessary parameters for an incoming hold invoice.

  @param args {object} {
    msats: {bigint} the amount in msats to use for the incoming invoice
    bolt11: {string} the bolt11 invoice to wrap
    maxRoutingFeeMsats: {bigint} the maximum routing fee in msats to use for the incoming invoice,
    hideInvoiceDesc: {boolean} whether to hide the invoice description
    description: {string} the description to use for the incoming invoice
    descriptionHash: {string} the description hash to use for the incoming invoice
  }
  @returns bolt11 {string} the wrapped incoming invoice
*/
export async function wrapBolt11 ({ msats, bolt11, maxRoutingFeeMsats, hideInvoiceDesc, description }) {
  const wrapped = await wrapBolt11Params({ msats, bolt11, maxRoutingFeeMsats, hideInvoiceDesc, description })
  return (await createHodlInvoice({ lnd, ...wrapped })).request
}

export async function canWrapBolt11 ({ msats, bolt11, maxRoutingFeeMsats, hideInvoiceDesc, description }) {
  try {
    await wrapBolt11Params({ msats, bolt11, maxRoutingFeeMsats, hideInvoiceDesc, description })
  } catch {
    return false
  }

  return true
}

async function wrapBolt11Params ({ msats, bolt11, maxRoutingFeeMsats, hideInvoiceDesc, description }) {
  try {
    console.group('wrapInvoice', description, 'msats', msats, 'maxRoutingFeeMsats', maxRoutingFeeMsats)

    // create a new object to hold the wrapped invoice values
    const wrapped = {}
    let outgoingMsat

    // decode the invoice
    const inv = await parsePaymentRequest({ request: bolt11 })
    if (!inv) {
      throw new Error('Unable to decode invoice')
    }

    console.log('invoice', inv.id, inv.mtokens, inv.expires_at, inv.cltv_delta, inv.destination)

    // validate fee
    if (maxRoutingFeeMsats) {
      maxRoutingFeeMsats = toPositiveBigInt(maxRoutingFeeMsats)
    } else {
      throw new Error('Fee percent is missing')
    }

    // validate outgoing amount
    if (inv.mtokens) {
      outgoingMsat = toPositiveBigInt(inv.mtokens)
      if (outgoingMsat < MIN_OUTGOING_MSATS) {
        throw new Error(`Invoice amount is too low: ${outgoingMsat}`)
      }
      if (outgoingMsat > MAX_OUTGOING_MSATS) {
        throw new Error(`Invoice amount is too high: ${outgoingMsat}`)
      }
    } else {
      throw new Error('Outgoing invoice is missing amount')
    }

    // validate incoming amount
    if (msats) {
      msats = toPositiveBigInt(msats)
      // outgoing amount should be smaller or equal to the incoming amount
      if (outgoingMsat > msats) {
        throw new Error(`Outgoing amount is too high: ${outgoingMsat} > ${msats}`)
      }
    } else {
      throw new Error('Incoming invoice amount is missing')
    }

    // validate features
    if (inv.features) {
      for (const f of inv.features) {
        switch (Number(f.bit)) {
          // supported features
          case 8: // variable length routing onion
          case 9:
          case 14: // payment secret
          case 15:
          case 16: // basic multi-part payment
          case 17:
          case 25: // blinded paths
          case 48: // TLV payment data
          case 49:
          case 149: // trampoline routing
          case 151: // electrum trampoline routing
          case 262:
          case 263: // blinded paths
            break
          default:
            throw new Error(`Unsupported feature bit: ${f.bit}`)
        }
      }
    } else {
      throw new Error('Invoice features are missing')
    }

    // validate the payment hash
    if (inv.id) {
      wrapped.id = inv.id
    } else {
      throw new Error('Invoice hash is missing')
    }

    // validate the description
    if (inv.description_hash) {
      // use the invoice description hash in case this is an lnurlp invoice
      wrapped.description_hash = inv.description_hash
    } else if (description && !hideInvoiceDesc) {
      // use our wrapped description
      wrapped.description = description
    } else if (!hideInvoiceDesc) {
      // use the invoice description
      wrapped.description = inv.description
    }

    // validate the expiration
    if (new Date(inv.expires_at) < new Date(Date.now() + INCOMING_EXPIRATION_BUFFER_MSECS)) {
      throw new Error('Invoice expiration is too soon')
    } else if (new Date(inv.expires_at) > new Date(Date.now() + MAX_EXPIRATION_INCOMING_MSECS)) {
      // trim the expiration to the maximum allowed with a buffer
      wrapped.expires_at = new Date(Date.now() + MAX_EXPIRATION_INCOMING_MSECS - INCOMING_EXPIRATION_BUFFER_MSECS)
    } else {
      // give the existing expiration a buffer
      wrapped.expires_at = new Date(new Date(inv.expires_at).getTime() - INCOMING_EXPIRATION_BUFFER_MSECS)
    }

    // get routing estimates
    const { routingFeeMsat, timeLockDelay } =
      await estimateRouteFeeProbe({
        lnd,
        request: bolt11,
        maxFeeMsat: maxRoutingFeeMsats,
        timeoutSeconds: FEE_ESTIMATE_TIMEOUT_SECS,
        maxCltvDelta: MAX_OUTGOING_CLTV_DELTA
      })

    const blockHeight = await getBlockHeight({ lnd })
    /*
      we want the incoming invoice to have MIN_SETTLEMENT_CLTV_DELTA higher final cltv delta than
      the expected ctlv_delta of the outgoing invoice's entire route

      timeLockDelay is the absolute height the outgoing route is estimated to expire in the worst case.
      It excludes the final hop's cltv_delta, so we add it. We subtract the blockheight,
      then add on how many blocks we want to reserve to settle the incoming payment,
      assuming the outgoing payment settles at the worst case (ie largest) height.
    */
    wrapped.cltv_delta = toPositiveNumber(
      toPositiveNumber(timeLockDelay) + toPositiveNumber(inv.cltv_delta) -
      toPositiveNumber(blockHeight) + MIN_SETTLEMENT_CLTV_DELTA + CLTV_DELTA_BUFFER)
    console.log('routingFeeMsat', routingFeeMsat, 'wrapped cltv_delta', wrapped.cltv_delta,
      'timeLockDelay', timeLockDelay, 'inv.cltv_delta', inv.cltv_delta, 'blockHeight', blockHeight)

    // validate the cltv delta
    if (wrapped.cltv_delta > MAX_OUTGOING_CLTV_DELTA) {
      throw new PayInFailureReasonError(`Estimated outgoing cltv delta is too high: ${wrapped.cltv_delta}`, 'INVOICE_WRAPPING_FAILED_HIGH_PREDICTED_EXPIRY')
    } else if (wrapped.cltv_delta < MIN_SETTLEMENT_CLTV_DELTA + toPositiveNumber(inv.cltv_delta)) {
      throw new PayInFailureReasonError(`Estimated outgoing cltv delta is too low: ${wrapped.cltv_delta}`, 'INVOICE_FORWARDING_CLTV_DELTA_TOO_LOW')
    }

    // validate the fee budget
    const minEstFees = toPositiveNumber(routingFeeMsat)
    if (minEstFees > maxRoutingFeeMsats) {
      throw new PayInFailureReasonError(`Estimated fees are too high (${minEstFees} > ${maxRoutingFeeMsats})`, 'INVOICE_WRAPPING_FAILED_HIGH_PREDICTED_FEE')
    }

    // calculate the incoming invoice amount, without fees
    wrapped.mtokens = String(msats)

    return wrapped
  } finally {
    console.groupEnd()
  }
}
