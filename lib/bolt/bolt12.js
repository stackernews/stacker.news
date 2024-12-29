/* eslint-disable camelcase */

import { payViaBolt12PaymentRequest, decodeBolt12Invoice } from '@/lib/lndk'
import { isBolt12Invoice, isBolt12Offer, isBolt12 } from '@/lib/bolt/bolt12-info'
import { toPositiveNumber } from '@/lib/format'
export { isBolt12Invoice, isBolt12Offer, isBolt12 }

export async function payBolt12 ({ lnd, request: invoice, max_fee, max_fee_mtokens }) {
  if (!isBolt12Invoice(invoice)) throw new Error('not a bolt12 invoice')
  return await payViaBolt12PaymentRequest({ lnd, request: invoice, max_fee, max_fee_mtokens })
}

export async function parseBolt12 ({ lnd, request: invoice }) {
  if (!isBolt12Invoice(invoice)) throw new Error('not a bolt12 request')
  const decodedInvoice = await decodeBolt12Invoice({ lnd, request: invoice })
  return convertBolt12RequestToLNRequest(decodedInvoice)
}

const featureBitTypes = {
  0: 'DATALOSS_PROTECT_REQ',
  1: 'DATALOSS_PROTECT_OPT',
  3: 'INITIAL_ROUTING_SYNC',
  4: 'UPFRONT_SHUTDOWN_SCRIPT_REQ',
  5: 'UPFRONT_SHUTDOWN_SCRIPT_OPT',
  6: 'GOSSIP_QUERIES_REQ',
  7: 'GOSSIP_QUERIES_OPT',
  8: 'TLV_ONION_REQ',
  9: 'TLV_ONION_OPT',
  10: 'EXT_GOSSIP_QUERIES_REQ',
  11: 'EXT_GOSSIP_QUERIES_OPT',
  12: 'STATIC_REMOTE_KEY_REQ',
  13: 'STATIC_REMOTE_KEY_OPT',
  14: 'PAYMENT_ADDR_REQ',
  15: 'PAYMENT_ADDR_OPT',
  16: 'MPP_REQ',
  17: 'MPP_OPT',
  18: 'WUMBO_CHANNELS_REQ',
  19: 'WUMBO_CHANNELS_OPT',
  20: 'ANCHORS_REQ',
  21: 'ANCHORS_OPT',
  22: 'ANCHORS_ZERO_FEE_HTLC_REQ',
  23: 'ANCHORS_ZERO_FEE_HTLC_OPT',
  24: 'ROUTE_BLINDING_REQUIRED',
  25: 'ROUTE_BLINDING_OPTIONAL',
  30: 'AMP_REQ',
  31: 'AMP_OPT'
}

const chainsMap = {
  '06226e46111a0b59caaf126043eb5bbf28c34f3a5e332a1fc7b2b73cf188910f': 'regtest',
  '43497fd7f826957108f4a30fd9cec3aeba79972084e90ead01ea330900000000': 'testnet',
  '6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000': 'mainnet'
}

async function convertBolt12RequestToLNRequest (decodedInvoice) {
  const {
    amount_msats,
    description,
    node_id,
    chain,
    payment_hash,
    created_at,
    relative_expiry,
    features,
    payer_note,
    payment_paths,
    invoice_hex_str
  } = decodedInvoice

  // convert from lndk response to ln-service parsePaymentRequest output layout
  let minCltvDelta
  for (const path of payment_paths) {
    const info = path.blinded_pay_info
    if (minCltvDelta === undefined || info.cltv_expiry_delta < minCltvDelta) {
      minCltvDelta = info.cltv_expiry_delta
    }
  }

  const out = {
    created_at: new Date(created_at * 1000).toISOString(),
    // [chain_addresses]
    cltv_delta: minCltvDelta,
    description: payer_note || description,
    // [description_hash]
    destination: Buffer.from(node_id.key).toString('hex'),
    expires_at: new Date((created_at + relative_expiry) * 1000).toISOString(),
    features: features.map(bit => ({
      bit,
      is_required: (bit % 2) === 0,
      type: featureBitTypes[bit]
    })),
    id: Buffer.from(payment_hash.hash).toString('hex'),
    is_expired: new Date().getTime() / 1000 > created_at + relative_expiry,
    // [metadata]
    mtokens: String(amount_msats),
    network: chainsMap[chain],
    payment: invoice_hex_str,
    routes: payment_paths.map((path) => {
      const info = path.blinded_pay_info
      const { introduction_node } = path.blinded_path
      return {
        base_fee_mtokens: String(info.fee_base_msat),
        cltv_delta: info.cltv_expiry_delta,
        public_key: Buffer.from(introduction_node.node_id.key).toString('hex')
      }
    }),
    safe_tokens: Math.round(toPositiveNumber(BigInt(amount_msats)) / 1000),
    tokens: Math.floor(toPositiveNumber(BigInt(amount_msats)) / 1000),
    bolt12: decodedInvoice
  }
  return out
}
