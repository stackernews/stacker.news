import { raceAbort, throwIfAborted } from '@/lib/time'
import { WalletValidationError } from '@/wallets/client/errors'
import { verifyPreimage } from '@/wallets/lib/preimage'
import { walletBalance } from './util'
import {
  openSparkWallet,
  sparkCurrencyAmountToMsats
} from '@/wallets/lib/protocols/spark'

export const name = 'SPARK'
export const enforcesMaxFee = true

const SPARK_FAILURE_STATUSES = new Set([
  'LIGHTNING_PAYMENT_FAILED',
  'PREIMAGE_PROVIDING_FAILED',
  'TRANSFER_FAILED',
  'USER_TRANSFER_VALIDATION_FAILED',
  'USER_SWAP_RETURNED',
  'USER_SWAP_RETURN_FAILED'
])
let wallets = new Set()

// Configured wallets stay open until they are disposed, allowing
// Spark to share one stream and transfer worker per identity ... because
// Spark wallets are super stateful/side effecting
async function getConfiguredWallet (mnemonic, signal) {
  if (!mnemonic) throw new WalletValidationError('Spark mnemonic required')

  const owner = wallets
  const { wallet } = await openSparkWallet({
    mnemonicOrSeed: mnemonic
  }, { signal, reuse: true })

  wallets.add(wallet)
  if (owner !== wallets) {
    throw new DOMException('Spark wallet disposed', 'AbortError')
  }

  throwIfAborted(signal)
  return wallet
}

export async function dispose () {
  const disposed = wallets
  wallets = new Set()
  await Promise.allSettled([...disposed].map(wallet => wallet.cleanup()))
}

export async function sendPayment (
  bolt11,
  { mnemonic },
  { signal, maxFee } = {}
) {
  const wallet = await getConfiguredWallet(mnemonic, signal)
  let payment
  try {
    payment = await raceAbort(wallet.payLightningInvoice({
      invoice: bolt11,
      ...(maxFee != null ? { maxFeeSats: maxFee } : {}),
      // External sends reconcile by BOLT11 hash through queryHTLC. Spark-native
      // transfers need their transfer ID persisted and checked separately.
      preferSpark: false,
      idempotencyKey: globalThis.crypto.randomUUID()
    }), signal)
  } catch (err) {
    throwIfAborted(signal)
    const { SparkValidationError } = await import('@buildonspark/spark-sdk')
    if (!(err instanceof SparkValidationError)) throw err
    return { status: 'FAILED', detail: err.initialMessage || 'Spark rejected the payment' }
  }

  if (payment.paymentPreimage) {
    return {
      status: 'SETTLED',
      preimage: payment.paymentPreimage,
      actualFeeMsats: sparkCurrencyAmountToMsats(payment.fee),
      settledAt: payment.updatedAt
    }
  }

  if (SPARK_FAILURE_STATUSES.has(payment.status)) {
    return {
      status: 'FAILED',
      detail: `Spark payment failed (${payment.status})`
    }
  }

  // The request id scopes later failure checks to this attempt. Hash-only
  // checks can prove settlement, but not which attempt failed.
  return {
    status: 'PENDING',
    ...(payment.id && { providerRequestId: payment.id })
  }
}

export async function checkPayment (
  { hash, bolt11, providerRequestId },
  { mnemonic },
  { signal } = {}
) {
  const wallet = await getConfiguredWallet(mnemonic, signal)
  const { PreimageRequestRole } = await raceAbort(
    import('@buildonspark/spark-sdk/proto/spark'),
    signal
  )
  const { preimageRequests } = await raceAbort(wallet.queryHTLC({
    paymentHashes: [hash],
    matchRole: PreimageRequestRole.PREIMAGE_REQUEST_ROLE_SENDER
  }), signal)

  for (const request of preimageRequests) {
    const preimage = Buffer.from(request.preimage ?? []).toString('hex')
    if (verifyPreimage(hash, preimage)) return { status: 'SETTLED', preimage }
  }

  if (!providerRequestId) return { status: 'PENDING' }

  const payment = await raceAbort(wallet.getLightningSendRequest(providerRequestId), signal)
  if (!bolt11 || payment?.encodedInvoice?.toLowerCase() !== bolt11.toLowerCase()) {
    return { status: 'PENDING' }
  }

  if (payment.paymentPreimage && verifyPreimage(hash, payment.paymentPreimage)) {
    return {
      status: 'SETTLED',
      preimage: payment.paymentPreimage,
      actualFeeMsats: sparkCurrencyAmountToMsats(payment.fee),
      settledAt: payment.updatedAt
    }
  }

  if (SPARK_FAILURE_STATUSES.has(payment.status)) {
    return {
      status: 'FAILED',
      detail: `Spark payment failed (${payment.status})`
    }
  }
  return { status: 'PENDING' }
}

export async function getBalance ({ mnemonic }, { signal } = {}) {
  const wallet = await getConfiguredWallet(mnemonic, signal)
  const balance = await raceAbort(wallet.getCachedBalance(), signal)
  return walletBalance(balance.satsBalance.available)
}

// Initialization is the configuration probe and also supplies the generated
// fields that the wallet form routes to the send and receive configurations.
export async function testSendPayment ({ mnemonic } = {}, { signal } = {}) {
  if (mnemonic) {
    const wallet = await getConfiguredWallet(mnemonic, signal)
    return testSparkWallet(wallet, mnemonic, signal)
  }

  let initialized
  try {
    initialized = await openSparkWallet({}, { signal })
    throwIfAborted(signal)
    return await testSparkWallet(initialized.wallet, initialized.mnemonic, signal)
  } finally {
    initialized?.wallet.cleanup().catch(() => {})
  }
}

async function testSparkWallet (wallet, mnemonic, signal) {
  if (!mnemonic) throw new Error('Spark wallet did not return a mnemonic')

  const identityPubkey = await raceAbort(wallet.getIdentityPublicKey(), signal)
  await raceAbort(wallet.setPrivacyEnabled(true), signal)
  return { mnemonic, identityPubkey }
}
