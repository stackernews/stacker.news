import { msatsToSats, toPositiveNumber } from '@/lib/format'
import { loadPackageDefinition } from '@grpc/grpc-js'
import LNDK_RPC_PROTO from '@/lib/lndkrpc-proto'
import protobuf from 'protobufjs'
import grpcCredentials from 'lightning/lnd_grpc/grpc_credentials'
import { defaultSocket, grpcSslCipherSuites } from 'lightning/grpc/index'
import { fromJSON } from '@grpc/proto-loader'
import * as bech32b12 from '@/lib/bech32b12'

/* eslint-disable camelcase */
const { GRPC_SSL_CIPHER_SUITES } = process.env

export function installLNDK (lnd, { cert, macaroon, socket }, withProxy) {
  if (lnd.lndk) return // already installed

  // workaround to load from string
  const protoArgs = {
    keepCase: true,
    longs: Number,
    defaults: true,
    oneofs: true
  }
  const proto = protobuf.parse(LNDK_RPC_PROTO, protoArgs).root
  const packageDefinition = fromJSON(proto.toJSON(), protoArgs)

  const protoDescriptor = loadPackageDefinition(packageDefinition)
  const OffersService = protoDescriptor.lndkrpc.Offers
  const { credentials } = grpcCredentials({ cert, macaroon })
  const params = {
    'grpc.max_receive_message_length': -1,
    'grpc.max_send_message_length': -1,
    'grpc.enable_http_proxy': withProxy ? 1 : 0
  }
  const lndSocket = socket || defaultSocket

  if (!!cert && GRPC_SSL_CIPHER_SUITES !== grpcSslCipherSuites) {
    process.env.GRPC_SSL_CIPHER_SUITES = grpcSslCipherSuites
  }

  const client = new OffersService(lndSocket, credentials, params)
  lnd.lndk = client
}

export async function fetchBolt12InvoiceFromOffer ({ lnd, offer, amount, description, timeout = 10_000 }) {
  const lndk = lnd.lndk
  if (!lndk) throw new Error('lndk not installed, please use installLNDK')
  return new Promise((resolve, reject) => {
    lndk.GetInvoice({
      offer,
      amount: toPositiveNumber(amount),
      payer_note: description,
      response_invoice_timeout: timeout
    }, (error, response) => {
      if (error) return reject(error)
      const bech32invoice = 'lni1' + bech32b12.encode(Buffer.from(response.invoice_hex_str, 'hex'))
      resolve(bech32invoice)
    })
  })
}

export async function payViaBolt12PaymentRequest ({
  lnd,
  request: invoice_hex_str,
  max_fee
}) {
  const lndk = lnd.lndk
  if (!lndk) throw new Error('lndk not installed, please use installLNDK')

  const bolt12 = await parseBolt12Request({ lnd, request: invoice_hex_str })

  const req = {
    invoice: bolt12.payment,
    amount: toPositiveNumber(bolt12.mtokens),
    max_fee
  }

  return new Promise((resolve, reject) => {
    lndk.PayInvoice(req, (error, response) => {
      if (error) {
        return reject(error)
      }
      resolve({
        secret: response.payment_preimage
      })
    })
  })
}

const featureBitMap = {
  0: { bit: 0, type: 'DATALOSS_PROTECT_REQ', is_required: true },
  1: { bit: 1, type: 'DATALOSS_PROTECT_OPT', is_required: false },
  3: { bit: 3, type: 'INITIAL_ROUTING_SYNC', is_required: true },
  4: { bit: 4, type: 'UPFRONT_SHUTDOWN_SCRIPT_REQ', is_required: true },
  5: { bit: 5, type: 'UPFRONT_SHUTDOWN_SCRIPT_OPT', is_required: false },
  6: { bit: 6, type: 'GOSSIP_QUERIES_REQ', is_required: true },
  7: { bit: 7, type: 'GOSSIP_QUERIES_OPT', is_required: false },
  8: { bit: 8, type: 'TLV_ONION_REQ', is_required: true },
  9: { bit: 9, type: 'TLV_ONION_OPT', is_required: false },
  10: { bit: 10, type: 'EXT_GOSSIP_QUERIES_REQ', is_required: true },
  11: { bit: 11, type: 'EXT_GOSSIP_QUERIES_OPT', is_required: false },
  12: { bit: 12, type: 'STATIC_REMOTE_KEY_REQ', is_required: true },
  13: { bit: 13, type: 'STATIC_REMOTE_KEY_OPT', is_required: false },
  14: { bit: 14, type: 'PAYMENT_ADDR_REQ', is_required: true },
  15: { bit: 15, type: 'PAYMENT_ADDR_OPT', is_required: false },
  16: { bit: 16, type: 'MPP_REQ', is_required: true },
  17: { bit: 17, type: 'MPP_OPT', is_required: false },
  18: { bit: 18, type: 'WUMBO_CHANNELS_REQ', is_required: true },
  19: { bit: 19, type: 'WUMBO_CHANNELS_OPT', is_required: false },
  20: { bit: 20, type: 'ANCHORS_REQ', is_required: true },
  21: { bit: 21, type: 'ANCHORS_OPT', is_required: false },
  22: { bit: 22, type: 'ANCHORS_ZERO_FEE_HTLC_REQ', is_required: true },
  23: { bit: 23, type: 'ANCHORS_ZERO_FEE_HTLC_OPT', is_required: false },
  24: { bit: 24, type: 'ROUTE_BLINDING_REQUIRED', is_required: true },
  25: { bit: 25, type: 'ROUTE_BLINDING_OPTIONAL', is_required: false },
  30: { bit: 30, type: 'AMP_REQ', is_required: true },
  31: { bit: 31, type: 'AMP_OPT', is_required: false }
}

const chainsMap = {
  '06226e46111a0b59caaf126043eb5bbf28c34f3a5e332a1fc7b2b73cf188910f': 'regtest',
  '43497fd7f826957108f4a30fd9cec3aeba79972084e90ead01ea330900000000': 'testnet',
  '6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000': 'mainnet'
}
// @returns
// {
//   [chain_addresses]: [<Chain Address String>]
//   cltv_delta: <CLTV Delta Number>
//   created_at: <Invoice Creation Date ISO 8601 String>
//   [description]: <Description String>
//   [description_hash]: <Description Hash Hex String>
//   destination: <Public Key String>
//   expires_at: <ISO 8601 Date String>
//   features: [{
//     bit: <BOLT 09 Feature Bit Number>
//     is_required: <Feature Support is Required To Pay Bool>
//     type: <Feature Type String>
//   }]
//   id: <Payment Request Hash String>
//   is_expired: <Invoice is Expired Bool>
//   [metadata]: <Payment Metadata Hex String>
//   [mtokens]: <Requested Milli-Tokens Value String> (can exceed Number limit)
//   network: <Network Name String>
//   [payment]: <Payment Identifier Hex Encoded String>
//   [routes]: [[{
//     [base_fee_mtokens]: <Base Fee Millitokens String>
//     [channel]: <Standard Format Channel Id String>
//     [cltv_delta]: <Final CLTV Expiration Blocks Delta Number>
//     [fee_rate]: <Fee Rate Millitokens Per Million Number>
//     public_key: <Forward Edge Public Key Hex String>
//   }]]
//   [safe_tokens]: <Requested Tokens Rounded Up Number>
//   [tokens]: <Requested Chain Tokens Number> (note: can differ from mtokens)
// }
export async function parseBolt12Request ({
  lnd,
  request
}) {
  const lndk = lnd?.lndk
  if (!lndk) throw new Error('lndk not installed, please use installLNDK')

  const invoice_hex_str = request.startsWith('lni1') ? bech32b12.decode(request.slice(4)).toString('hex') : request

  const invoice_contents = await new Promise((resolve, reject) => {
    lndk.DecodeInvoice({
      invoice: invoice_hex_str
    }, (error, response) => {
      if (error) return reject(error)
      resolve(response)
    })
  })

  const {
    amount_msats,
    description,
    node_id,
    chain,
    payment_hash,
    created_at,
    relative_expiry,
    features
  } = invoice_contents

  // convert from lndk response to ln-service parsePaymentRequest output layout
  let minCltvDelta
  for (const path of invoice_contents.payment_paths) {
    const info = path.blinded_pay_info
    if (minCltvDelta === undefined || info.cltv_expiry_delta < minCltvDelta) {
      minCltvDelta = info.cltv_expiry_delta
    }
  }

  const out = {
    created_at: new Date(created_at * 1000).toISOString(),
    // [chain_addresses]
    cltv_delta: minCltvDelta,
    description,
    // [description_hash]
    destination: Buffer.from(node_id.key).toString('hex'),
    expires_at: new Date((created_at + relative_expiry) * 1000).toISOString(),
    features: features.map(bit => featureBitMap[bit]),
    id: Buffer.from(payment_hash.hash).toString('hex'),
    is_expired: new Date().getTime() / 1000 > created_at + relative_expiry,
    // [metadata]
    mtokens: '' + amount_msats,
    network: chainsMap[chain],
    payment: invoice_hex_str,
    routes: invoice_contents.payment_paths.map((path) => {
      const info = path.blinded_pay_info
      const { introduction_node } = path.blinded_path
      return {
        base_fee_mtokens: '' + info.fee_base_msat,
        cltv_delta: info.cltv_expiry_delta,
        public_key: Buffer.from(introduction_node.node_id.key).toString('hex')
      }
    }),
    safe_tokens: Math.round(toPositiveNumber(BigInt(amount_msats)) / 1000),
    tokens: Math.floor(toPositiveNumber(BigInt(amount_msats)) / 1000)
  }

  // mark as bolt12 invoice so we can differentiate it later (this will be used also to pass bolt12 only data)
  out.bolt12 = invoice_contents

  return out
}

export async function estimateBolt12RouteFee ({ lnd, destination, tokens, mtokens, request, timeout }) {
  const lndk = lnd?.lndk
  if (!lndk) throw new Error('lndk not installed, please use installLNDK')
  const parsedInvoice = request ? await parseBolt12Request({ lnd, request }) : {}
  mtokens ??= parsedInvoice.mtokens
  destination ??= parsedInvoice.destination

  return await new Promise((resolve, reject) => {
    const params = {}
    params.dest = Buffer.from(destination, 'hex')
    params.amt_sat = null
    if (tokens) params.amt_sat = toPositiveNumber(tokens)
    else if (mtokens) params.amt_sat = msatsToSats(mtokens)

    if (params.amt_sat === null) {
      throw new Error('No tokens or mtokens provided')
    }

    lnd.router.estimateRouteFee({
      ...params,
      timeout
    }, (err, res) => {
      if (err) {
        if (res?.failure_reason) {
          reject(new Error(`Unable to estimate route: ${res.failure_reason}`))
        } else {
          reject(err)
        }
        return
      }

      if (res.routing_fee_msat < 0 || res.time_lock_delay <= 0) {
        reject(new Error('Unable to estimate route, excessive values: ' + JSON.stringify(res)))
        return
      }

      resolve({
        routingFeeMsat: toPositiveNumber(res.routing_fee_msat),
        timeLockDelay: toPositiveNumber(res.time_lock_delay)
      })
    })
  })
}
