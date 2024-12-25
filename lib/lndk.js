import { msatsToSats, satsToMsats, toPositiveNumber } from '@/lib/format'
import { loadPackageDefinition } from '@grpc/grpc-js'
import LNDK_RPC_PROTO from '@/lib/lndkrpc-proto'
import protobuf from 'protobufjs'
import grpcCredentials from 'lightning/lnd_grpc/grpc_credentials'
import { grpcSslCipherSuites } from 'lightning/grpc/index'
import { fromJSON } from '@grpc/proto-loader'
import * as bech32b12 from '@/lib/bech32b12'
/* eslint-disable camelcase */
const { GRPC_SSL_CIPHER_SUITES } = process.env

export function installLNDK (lnd, { cert, macaroon, socket: lndkSocket }, withProxy) {
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

  if (!!cert && GRPC_SSL_CIPHER_SUITES !== grpcSslCipherSuites) {
    process.env.GRPC_SSL_CIPHER_SUITES = grpcSslCipherSuites
  }

  const client = new OffersService(lndkSocket, credentials, params)
  lnd.lndk = client
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
    features,
    payer_note
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
    routes: invoice_contents.payment_paths.map((path) => {
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
    bolt12: invoice_contents
  }

  return out
}

export async function fetchBolt12InvoiceFromOffer ({ lnd, offer, msats, description, timeout = 10_000 }) {
  const lndk = lnd?.lndk
  if (!lndk) throw new Error('lndk not installed, please use installLNDK')

  return new Promise((resolve, reject) => {
    lndk.GetInvoice({
      offer,
      // expects msats https://github.com/lndk-org/lndk/blob/bce93885f5fc97f3ceb15dc470117e10061de018/src/lndk_offers.rs#L182
      amount: toPositiveNumber(msats),
      payer_note: description,
      response_invoice_timeout: timeout
    }, async (error, response) => {
      try {
        if (error) return reject(error)
        const bech32invoice = 'lni1' + bech32b12.encode(Buffer.from(response.invoice_hex_str, 'hex'))

        // sanity check
        const parsedInvoice = await parseBolt12Request({ lnd, request: bech32invoice })
        if (
          !parsedInvoice ||
          toPositiveNumber(parsedInvoice.mtokens) !== toPositiveNumber(msats) ||
          toPositiveNumber(parsedInvoice.tokens) !== toPositiveNumber(msatsToSats(msats))
        ) {
          return reject(new Error('invalid invoice response'))
        }
        resolve(bech32invoice)
      } catch (e) {
        reject(e)
      }
    })
  })
}

export async function payViaBolt12PaymentRequest ({
  lnd,
  request: invoice_hex_str,
  max_fee,
  max_fee_mtokens
}) {
  const lndk = lnd?.lndk
  if (!lndk) throw new Error('lndk not installed, please use installLNDK')

  const parsedInvoice = await parseBolt12Request({ lnd, request: invoice_hex_str })

  if (!max_fee_mtokens && max_fee) {
    max_fee_mtokens = toPositiveNumber(satsToMsats(max_fee))
  }

  return new Promise((resolve, reject) => {
    lndk.PayInvoice({
      invoice: parsedInvoice.payment,
      // expects msats amount: https://github.com/lndk-org/lndk/blob/bce93885f5fc97f3ceb15dc470117e10061de018/src/lib.rs#L403
      amount: toPositiveNumber(parsedInvoice.mtokens),
      max_fee: toPositiveNumber(max_fee_mtokens)
    }, (error, response) => {
      if (error) {
        return reject(error)
      }
      resolve({
        secret: response.payment_preimage
      })
    })
  })
}

export async function estimateBolt12RouteFee ({ lnd, destination, tokens, mtokens, request, timeout }) {
  const lndk = lnd?.lndk
  if (!lndk) throw new Error('lndk not installed, please use installLNDK')
  const parsedInvoice = request ? await parseBolt12Request({ lnd, request }) : {}

  if (!tokens && mtokens) tokens = toPositiveNumber(msatsToSats(mtokens))
  tokens ??= toPositiveNumber(parsedInvoice.tokens)
  destination ??= parsedInvoice.destination

  if (!destination) throw new Error('no destination provided')
  if (!tokens) throw new Error('no tokens provided')

  return await new Promise((resolve, reject) => {
    lnd.router.estimateRouteFee({
      dest: Buffer.from(destination, 'hex'),
      amt_sat: tokens,
      timeout
    }, (err, res) => {
      if (err) {
        if (res?.failure_reason) {
          reject(new Error(`unable to estimate route: ${res.failure_reason}`))
        } else {
          reject(err)
        }
        return
      }

      if (res.routing_fee_msat < 0 || res.time_lock_delay <= 0) {
        reject(new Error('unable to estimate route, excessive values: ' + JSON.stringify(res)))
        return
      }

      resolve({
        routingFeeMsat: toPositiveNumber(res.routing_fee_msat),
        timeLockDelay: toPositiveNumber(res.time_lock_delay)
      })
    })
  })
}
