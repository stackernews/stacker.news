export const name = 'SPARK'

const SPARK_NETWORK = (process.env.NEXT_PUBLIC_SPARK_NETWORK || (process.env.NODE_ENV === 'production' ? 'MAINNET' : 'REGTEST')).toUpperCase()
const SPARK_SEND_FEE_BUFFER_SATS = 5
const SPARK_SEND_POLL_INTERVAL_MS = 100
const SPARK_FAILURE_STATUSES = new Set([
  'LIGHTNING_PAYMENT_FAILED',
  'PREIMAGE_PROVIDING_FAILED',
  'TRANSFER_FAILED',
  'USER_TRANSFER_VALIDATION_FAILED',
  'USER_SWAP_RETURN_FAILED'
])

// abort-aware sleep: the shared lib/time.js sleep ignores AbortSignal,
// and the outer WALLET_SEND_PAYMENT_TIMEOUT_MS is what actually bounds this loop.
function sleep (ms, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timeout)
      reject(signal?.reason instanceof Error ? signal.reason : new Error('aborted'))
    }
    if (signal?.aborted) return onAbort()
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function initializeSparkWallet ({ mnemonic } = {}) {
  const { SparkWallet } = await import('@buildonspark/spark-sdk')
  const result = await SparkWallet.initialize({
    ...(mnemonic ? { mnemonicOrSeed: mnemonic } : {}),
    options: {
      network: SPARK_NETWORK
    }
  })
  // SDK echoes mnemonic back when it generates one; preserve caller-supplied mnemonic otherwise.
  return { wallet: result.wallet, mnemonic: result.mnemonic ?? mnemonic }
}

async function cleanupSparkWallet (wallet) {
  try {
    await wallet?.cleanupConnections?.()
  } catch {}
}

export function maxFeeSatsFromEstimate (feeEstimate) {
  if (typeof feeEstimate !== 'number' || !Number.isFinite(feeEstimate) || feeEstimate < 0) {
    throw new Error(`Spark fee estimate must be a non-negative number, got ${JSON.stringify(feeEstimate)}`)
  }
  return Math.ceil(feeEstimate) + SPARK_SEND_FEE_BUFFER_SATS
}

export async function waitForPreimage (wallet, id, { signal } = {}) {
  while (true) {
    signal?.throwIfAborted()

    const sendRequest = await wallet.getLightningSendRequest(id)
    if (!sendRequest) {
      throw new Error('Spark payment status unavailable')
    }

    if (sendRequest.paymentPreimage) {
      return sendRequest.paymentPreimage
    }

    if (SPARK_FAILURE_STATUSES.has(sendRequest.status)) {
      throw new Error(`Spark payment failed (${sendRequest.status})`)
    }

    // Keep polling on any non-failure status (including LIGHTNING_PAYMENT_SUCCEEDED etc.)
    // because the SDK sometimes reports a final status before paymentPreimage is populated.
    // The outer WALLET_SEND_PAYMENT_TIMEOUT_MS aborts the signal if this takes too long.
    await sleep(SPARK_SEND_POLL_INTERVAL_MS, { signal })
  }
}

export async function getSparkWalletConfig ({ mnemonic } = {}) {
  let wallet
  try {
    ({ wallet, mnemonic } = await initializeSparkWallet({ mnemonic }))
    if (!mnemonic) {
      throw new Error('Spark wallet did not return a mnemonic')
    }
    const identityPubkey = await wallet.getIdentityPublicKey()
    return { mnemonic, identityPubkey }
  } finally {
    await cleanupSparkWallet(wallet)
  }
}

export function sparkConfigPatches ({ mnemonic, identityPubkey }, protocol) {
  if (protocol.send) {
    return {
      current: { mnemonic },
      complementary: { identityPubkey }
    }
  }

  return {
    current: { identityPubkey },
    complementary: { mnemonic }
  }
}

export async function prepareConfig (protocol, values, { complementary } = {}) {
  if (protocol.send) {
    if (values.mnemonic && complementary?.identityPubkey) {
      return
    }
  } else if (values.identityPubkey) {
    return
  }

  return sparkConfigPatches(
    await getSparkWalletConfig({ mnemonic: values.mnemonic || complementary?.mnemonic }),
    protocol
  )
}

export async function sendPayment (bolt11, { mnemonic }, { signal } = {}) {
  let wallet
  try {
    ({ wallet } = await initializeSparkWallet({ mnemonic }))

    signal?.throwIfAborted()

    const feeEstimate = await wallet.getLightningSendFeeEstimate({
      encodedInvoice: bolt11
    })

    signal?.throwIfAborted()

    const payment = await wallet.payLightningInvoice({
      invoice: bolt11,
      maxFeeSats: maxFeeSatsFromEstimate(feeEstimate)
    })

    if (payment.paymentPreimage) {
      return payment.paymentPreimage
    }

    if (!payment.id) {
      throw new Error('Spark payment settled without preimage')
    }

    return await waitForPreimage(wallet, payment.id, { signal })
  } finally {
    await cleanupSparkWallet(wallet)
  }
}

// probe: initialize the wallet, derive identity, and round-trip the SDK's getBalance
// to verify SSP/coordinator reachability. Without SN-hosted probe invoices we can't
// verify outbound liquidity, but this catches "mnemonic decodes but SDK is broken"
// cases (bad network, missing SSP, version skew) before users think send works.
export async function testSendPayment ({ mnemonic } = {}) {
  let wallet
  try {
    ({ wallet } = await initializeSparkWallet({ mnemonic }))
    const identityPubkey = await wallet.getIdentityPublicKey()
    if (!identityPubkey) {
      throw new Error('Spark wallet did not return an identity pubkey')
    }
    await wallet.getBalance()
  } finally {
    await cleanupSparkWallet(wallet)
  }
}
