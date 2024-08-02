import { createHodlInvoice, getHeight, parsePaymentRequest } from 'ln-service'
import { estimateRouteFee } from '../api/lnd'

const MIN_OUTGOING_MSATS = BigInt(900) // the minimum msats we'll allow for the outgoing invoice
const MAX_OUTGOING_MSATS = BigInt(9_000_000_000) // the maximum msats we'll allow for the outgoing  invoice
const MAX_EXPIRATION_INCOMING_MSECS = 900_000 // the maximum expiration time we'll allow for the incoming invoice
const INCOMING_EXPIRATION_BUFFER_MSECS = 300_000 // the buffer enforce for the incoming invoice expiration
const MIN_INCOMING_CLTV_DELTA = 200 // the minimum cltv delta we'll allow for the incoming invoice
const MAX_OUTGOING_CLTV_DELTA = 360 // the maximum cltv delta we'll allow for the outgoing invoice
export const MIN_SETTLEMENT_CLTV_DELTA = 80 // the minimum blocks we'll leave for settling the incoming invoice
const FEE_ESTIMATE_TIMEOUT_SECS = 5 // the timeout for the fee estimate request
const MAX_FEE_ESTIMATE_PERCENT = 0.02 // the maximum fee relative to outgoing we'll allow for the fee estimate
const OUTGOING_ROUTING_ESTIMATE_MULT = 1.1 // pad the budget for outgoing routing
const ZAP_SYBIL_FEE_MULT = 10 / 9 // the fee for the zap sybil service

/*
  The wrapInvoice function is used to wrap an outgoing invoice with the necessary parameters for an incoming hold invoice.

  @param bolt11 {string} the bolt11 invoice to wrap
  @param options {object}
  @returns {
    invoice: the wrapped incoming invoice,
    outgoingMaxFeeMsat: number
  }
*/
export default async function wrapInvoice (bolt11, { description, descriptionHash }, { lnd }) {
  try {
    console.group('wrapInvoice', description)

    // create a new object to hold the wrapped invoice values
    const wrapped = {}
    let outgoingMsat
    let outgoingMaxFeeMsat

    // decode the invoice
    const inv = await parsePaymentRequest({ request: bolt11 })
    if (!inv) {
      throw new Error('Unable to decode invoice')
    }

    console.log('invoice', inv.mtokens, inv.expires_at, inv.cltv_delta)

    // validate amount
    if (inv.mtokens) {
      if (inv.mtokens < MIN_OUTGOING_MSATS) {
        throw new Error(`Invoice amount is too low: ${inv.mtokens}`)
      }
      if (inv.mtokens > MAX_OUTGOING_MSATS || inv.mtokens >= Number.MAX_SAFE_INTEGER) {
        throw new Error(`Invoice amount is too high: ${inv.mtokens}`)
      }
      outgoingMsat = Number(inv.mtokens)
    } else {
      throw new Error('Invoice amount is missing')
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
    if (description && descriptionHash) {
      throw new Error('Only one of description or descriptionHash is allowed')
    } else if (description) {
    // use our wrapped description
      wrapped.description = description
    } else if (descriptionHash) {
    // use our wrapped description hash
      wrapped.description_hash = descriptionHash
    } else if (inv.description_hash) {
    // use the invoice description hash
      wrapped.description_hash = inv.description_hash
    } else {
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
      await estimateRouteFee({
        lnd,
        destination: inv.destination,
        mtokens: inv.mtokens,
        request: bolt11,
        timeout: FEE_ESTIMATE_TIMEOUT_SECS
      })

    const { current_block_height: blockHeight } = await getHeight({ lnd })
    /*
      we want the incoming invoice to have MIN_SETTLEMENT_CLTV_DELTA higher final cltv delta than
      the expected ctlv_delta of the outgoing invoice's entire route

      timeLockDelay is the absolute height the outgoing route is estimated to expire in the worst case.
      It excludes the final hop's cltv_delta, so we add it. We subtract the blockheight,
      then add on how many blocks we want to reserve to settle the incoming payment,
      assuming the outgoing payment settles at the worst case (ie largest) height.
    */
    wrapped.cltv_delta = Number(timeLockDelay) + inv.cltv_delta - blockHeight + MIN_SETTLEMENT_CLTV_DELTA
    console.log('routingFeeMsat', routingFeeMsat, 'timeLockDelay', timeLockDelay, 'blockHeight', blockHeight)

    // validate the cltv delta
    if (wrapped.cltv_delta > MAX_OUTGOING_CLTV_DELTA) {
      throw new Error('Estimated outgoing cltv delta is too high: ' + wrapped.cltv_delta)
    } else if (wrapped.cltv_delta < MIN_INCOMING_CLTV_DELTA) {
      // enforce a minimum cltv delta for the incoming invoice
      wrapped.cltv_delta = MIN_INCOMING_CLTV_DELTA
    }

    // validate the fee budget
    // ???: it might make sense to charge outgoing fees to the recipient instead of the sender
    // it's more incentive compatible, but it's also more complex
    const minEstFees = Number(routingFeeMsat)
    if (minEstFees > MAX_FEE_ESTIMATE_PERCENT * outgoingMsat) {
      throw new Error('Estimated fees are too high')
    } else {
      // calculate the fees, adding a little extra incase estimate is off
      outgoingMaxFeeMsat = Math.ceil(minEstFees * OUTGOING_ROUTING_ESTIMATE_MULT)
      // calculate the incoming invoice amount, without fees
      const incomingMsat = Math.ceil(outgoingMsat * ZAP_SYBIL_FEE_MULT)
      // the incoming invoice amount with the outgoing fees included
      wrapped.mtokens = String(incomingMsat + outgoingMaxFeeMsat)
    }

    console.log('outgoingMaxFeeMsat', outgoingMaxFeeMsat, 'wrapped', wrapped)

    return {
      invoice: await createHodlInvoice({ lnd, ...wrapped }),
      maxFee: outgoingMaxFeeMsat
    }
  } finally {
    console.groupEnd()
  }
}
