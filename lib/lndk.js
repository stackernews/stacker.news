import { satsToMsats, toPositiveNumber } from '@/lib/format'
import { loadPackageDefinition } from '@grpc/grpc-js'
import LNDK_RPC_PROTO from '@/lib/lndkrpc-proto'
import protobuf from 'protobufjs'
import grpcCredentials from 'lightning/lnd_grpc/grpc_credentials'
import { grpcSslCipherSuites } from 'lightning/grpc/index'
import { fromJSON } from '@grpc/proto-loader'
import { estimateRouteFee } from '@/api/lnd'
import * as bech32b12 from '@/lib/bech32b12'

/* eslint-disable camelcase */
const { GRPC_SSL_CIPHER_SUITES } = process.env

const lndkInstances = new WeakMap()

export function enableLNDK (lnd, { cert, macaroon, socket: lndkSocket }, withProxy) {
  // already installed
  if (lndkInstances.has(lnd)) return
  console.log('enabling lndk', lndkSocket, 'withProxy', withProxy)

  // workaround to load from string
  const protoArgs = { keepCase: true, longs: Number, defaults: true, oneofs: true }
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
  lndkInstances.set(lnd, client)
}

export function getLNDK (lnd) {
  if (!lndkInstances.has(lnd)) {
    throw new Error('lndk not available, please use enableLNDK first')
  }
  return lndkInstances.get(lnd)
}

export async function decodeBolt12Invoice ({
  lnd,
  request
}) {
  const lndk = getLNDK(lnd)

  // decode bech32 bolt12 invoice to hex string
  if (!request.startsWith('lni1')) throw new Error('not a valid bech32 encoded bolt12 invoice')
  const invoice_hex_str = bech32b12.decode(request.slice(4)).toString('hex')

  const decodedRequest = await new Promise((resolve, reject) => {
    lndk.DecodeInvoice({
      invoice: invoice_hex_str
    }, (error, response) => {
      if (error) return reject(error)
      resolve(response)
    })
  })

  return { ...decodedRequest, invoice_hex_str }
}

export async function fetchBolt12InvoiceFromOffer ({ lnd, offer, msats, description, timeout = 10_000 }) {
  const lndk = getLNDK(lnd)

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
        // encode hex string invoice to bech32
        const bech32invoice = 'lni1' + bech32b12.encode(Buffer.from(response.invoice_hex_str, 'hex'))

        // sanity check
        const { amount_msats } = await decodeBolt12Invoice({ lnd, request: bech32invoice })
        if (toPositiveNumber(amount_msats) !== toPositiveNumber(msats)) {
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
  request: invoiceBech32,
  max_fee,
  max_fee_mtokens
}) {
  const lndk = getLNDK(lnd)

  const { amount_msats, invoice_hex_str } = await decodeBolt12Invoice({ lnd, request: invoiceBech32 })

  if (!max_fee_mtokens && max_fee) {
    max_fee_mtokens = toPositiveNumber(satsToMsats(max_fee))
  }

  return new Promise((resolve, reject) => {
    lndk.PayInvoice({
      invoice: invoice_hex_str,
      // expects msats amount: https://github.com/lndk-org/lndk/blob/bce93885f5fc97f3ceb15dc470117e10061de018/src/lib.rs#L403
      amount: toPositiveNumber(amount_msats),
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
  const { amount_msats, node_id } = request ? await decodeBolt12Invoice({ lnd, request }) : {}

  // extract mtokens and destination from invoice if they are not provided
  if (!tokens && !mtokens) mtokens = toPositiveNumber(amount_msats)
  destination ??= Buffer.from(node_id.key).toString('hex')

  if (!destination) throw new Error('no destination provided')
  if (!tokens && !mtokens) throw new Error('no tokens amount provided')

  return await estimateRouteFee({ lnd, destination, tokens, mtokens, timeout })
}
