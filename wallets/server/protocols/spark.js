import { msatsToSats } from '@/lib/format'
import { raceAbort, throwIfAborted, withTimeoutSignal } from '@/lib/time'
import { verificationUnsupportedResult } from '@/wallets/lib/external-transactions'
import {
  openSparkWallet,
  sparkCurrencyAmountToMsats
} from '@/wallets/lib/protocols/spark'

export const name = 'SPARK'

const SPARK_RECEIVE_FAILURE_STATUSES = new Set([
  'TRANSFER_CREATION_FAILED',
  'REFUND_SIGNING_COMMITMENTS_QUERYING_FAILED',
  'REFUND_SIGNING_FAILED',
  'PAYMENT_PREIMAGE_RECOVERING_FAILED',
  'TRANSFER_FAILED'
])
const SERVICE_WALLET_INITIALIZATION_TIMEOUT_MS = 10_000
const SERVICE_WALLET_RETRY_MS = 5_000
let serviceWalletPromise
let serviceWalletRetryAt

async function withServiceWallet (signal, operation) {
  throwIfAborted(signal)

  if (!serviceWalletPromise || (serviceWalletRetryAt && serviceWalletRetryAt <= Date.now())) {
    const mnemonic = process.env.SPARK_SERVICE_MNEMONIC
    if (!mnemonic) throw new Error('Spark receive service is unavailable')
    serviceWalletRetryAt = undefined

    const initialization = withTimeoutSignal(
      SERVICE_WALLET_INITIALIZATION_TIMEOUT_MS,
      async initializationSignal => {
        const { wallet } = await openSparkWallet({
          mnemonicOrSeed: mnemonic
        }, { signal: initializationSignal })
        return wallet
      }
    ).catch(err => {
      if (serviceWalletPromise === initialization) {
        serviceWalletRetryAt = Date.now() + SERVICE_WALLET_RETRY_MS
      }
      throw err
    })
    serviceWalletPromise = initialization
  }

  const wallet = await raceAbort(serviceWalletPromise, signal)
  throwIfAborted(signal)
  return raceAbort(operation(wallet), signal)
}

// used by tests to close the service wallet singleton
export async function closeServiceWallet () {
  const initialization = serviceWalletPromise
  serviceWalletPromise = undefined
  serviceWalletRetryAt = undefined

  try {
    const wallet = await initialization
    await wallet?.cleanup()
  } catch {}
}

export async function createInvoice (
  { msats, description, descriptionHash, expiry },
  { identityPubkey },
  { signal } = {}
) {
  const request = await withServiceWallet(signal, wallet =>
    wallet.createLightningInvoice({
      // Spark accepts integer sats only; the receive pipeline tolerates the
      // sub-sat remainder discarded here.
      amountSats: msatsToSats(msats),
      expirySeconds: expiry,
      receiverIdentityPubkey: identityPubkey,
      ...(descriptionHash
        ? { descriptionHash }
        : { memo: description })
    }))
  const bolt11 = request?.invoice?.encodedInvoice
  if (!request?.id || !bolt11) throw new Error('Spark returned an invalid invoice')

  return {
    bolt11,
    providerRequestId: request.id
  }
}

export async function checkInvoice (transaction, { identityPubkey } = {}, { signal } = {}) {
  const id = transaction?.providerRequestId
  if (!id) return verificationUnsupportedResult('Spark invoice request id unavailable')

  const request = await withServiceWallet(signal, wallet =>
    wallet.getLightningReceiveRequest(id))
  if (!request) return { status: 'PENDING' }

  const receiverIdentityPubkey = request.receiverIdentityPublicKey
  if (receiverIdentityPubkey && receiverIdentityPubkey.toLowerCase() !== identityPubkey.toLowerCase()) {
    return verificationUnsupportedResult('Spark invoice request id does not match configured receiver identity')
  }

  if (request.invoice.paymentHash.toLowerCase() !== transaction.hash.toLowerCase()) {
    return verificationUnsupportedResult('Spark invoice request id does not match transaction hash')
  }

  if (request.status === 'TRANSFER_COMPLETED') {
    const receivedMsats = sparkCurrencyAmountToMsats(request.transfer?.totalAmount)
    return {
      status: 'SETTLED',
      preimage: request.paymentPreimage,
      ...(receivedMsats != null && { msats: receivedMsats }),
      settledAt: request.updatedAt
    }
  }

  if (SPARK_RECEIVE_FAILURE_STATUSES.has(request.status)) {
    return {
      status: 'FAILED',
      detail: `Spark invoice failed (${request.status})`
    }
  }

  return { status: 'PENDING' }
}

export async function testCreateInvoice ({ identityPubkey }, opts) {
  return await createInvoice(
    { msats: 1000, description: 'SN test invoice', expiry: 1 },
    { identityPubkey },
    opts
  )
}
