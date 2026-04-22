import { createHash } from 'node:crypto'
import { SparkWallet } from '@buildonspark/spark-sdk'
import lnService from 'ln-service'

const { parsePaymentRequest } = lnService

const SPARK_NETWORK = 'REGTEST'
const SPARK_SEND_FEE_BUFFER_SATS = 5
const SPARK_SEND_POLL_INTERVAL_MS = 100
const SPARK_AMOUNT_SATS = 1

function requireEnv (name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} not set`)
  }

  return value
}

async function initializeWallet (mnemonic) {
  const { wallet } = await SparkWallet.initialize({
    mnemonicOrSeed: mnemonic,
    options: {
      network: SPARK_NETWORK
    }
  })

  return wallet
}

async function cleanupWallet (wallet) {
  try {
    await wallet?.cleanupConnections?.()
  } catch {}
}

function maxFeeSatsFromEstimate (feeEstimate) {
  if (typeof feeEstimate !== 'number' || !Number.isFinite(feeEstimate) || feeEstimate < 0) {
    throw new Error(`Spark fee estimate must be a non-negative number, got ${JSON.stringify(feeEstimate)}`)
  }
  return Math.ceil(feeEstimate) + SPARK_SEND_FEE_BUFFER_SATS
}

async function waitForPreimage (wallet, id) {
  const failureStatuses = new Set([
    'LIGHTNING_PAYMENT_FAILED',
    'PREIMAGE_PROVIDING_FAILED',
    'TRANSFER_FAILED',
    'USER_TRANSFER_VALIDATION_FAILED',
    'USER_SWAP_RETURN_FAILED'
  ])

  while (true) {
    const sendRequest = await wallet.getLightningSendRequest(id)
    if (!sendRequest) {
      throw new Error('Spark payment status unavailable')
    }

    if (sendRequest.paymentPreimage) {
      return sendRequest.paymentPreimage
    }

    if (failureStatuses.has(sendRequest.status)) {
      throw new Error(`Spark payment failed (${sendRequest.status})`)
    }

    await new Promise(resolve => setTimeout(resolve, SPARK_SEND_POLL_INTERVAL_MS))
  }
}

async function main () {
  if (process.env.RUN_SPARK_LIVE !== '1') {
    throw new Error('RUN_SPARK_LIVE=1 is required')
  }

  const serviceMnemonic = requireEnv('SPARK_SERVICE_MNEMONIC')
  const payerMnemonic = requireEnv('SPARK_PAYER_MNEMONIC')
  const receiverMnemonic = requireEnv('SPARK_RECEIVER_MNEMONIC')

  let serviceWallet
  let payerWallet
  let receiverWallet

  try {
    serviceWallet = await initializeWallet(serviceMnemonic)
    payerWallet = await initializeWallet(payerMnemonic)
    receiverWallet = await initializeWallet(receiverMnemonic)

    const receiverIdentityPubkey = await receiverWallet.getIdentityPublicKey()
    console.log('receiver identity pubkey:', receiverIdentityPubkey)

    const request = await serviceWallet.createLightningInvoice({
      amountSats: SPARK_AMOUNT_SATS,
      memo: 'SN live Spark e2e',
      expirySeconds: 60,
      receiverIdentityPubkey
    })
    const bolt11 = request?.invoice?.encodedInvoice
    if (!bolt11) {
      throw new Error('Spark did not return a bolt11 invoice')
    }

    console.log('invoice:', bolt11)

    const decoded = parsePaymentRequest({ request: bolt11 })
    const feeEstimate = await payerWallet.getLightningSendFeeEstimate({
      encodedInvoice: bolt11
    })
    const payment = await payerWallet.payLightningInvoice({
      invoice: bolt11,
      maxFeeSats: maxFeeSatsFromEstimate(feeEstimate)
    })

    if (!payment.paymentPreimage && !payment.id) {
      throw new Error('Spark payment settled without preimage')
    }

    const preimage = payment.paymentPreimage || await waitForPreimage(payerWallet, payment.id)
    const paymentHash = createHash('sha256')
      .update(Buffer.from(preimage, 'hex'))
      .digest('hex')

    if (paymentHash !== decoded.id) {
      throw new Error(`preimage hash mismatch: expected ${decoded.id} got ${paymentHash}`)
    }

    console.log('payment preimage:', preimage)
    console.log('fee estimate sats:', feeEstimate)
    console.log('live Spark e2e ok')
  } finally {
    await Promise.all([
      cleanupWallet(serviceWallet),
      cleanupWallet(payerWallet),
      cleanupWallet(receiverWallet)
    ])
  }
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
