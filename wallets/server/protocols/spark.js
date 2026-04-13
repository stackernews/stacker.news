import { msatsToSats } from '@/lib/format'

export const name = 'SPARK'

const SPARK_NETWORK = (process.env.NEXT_PUBLIC_SPARK_NETWORK || (process.env.NODE_ENV === 'production' ? 'MAINNET' : 'REGTEST')).toUpperCase()
const COMPRESSED_PUBKEY = /^0[23][0-9a-fA-F]{64}$/
const HEX_32 = /^[0-9a-fA-F]{64}$/

let serviceWalletPromise

function sparkServiceMnemonic () {
  if (!process.env.SPARK_SERVICE_MNEMONIC) {
    throw new Error('SPARK_SERVICE_MNEMONIC not set')
  }

  return process.env.SPARK_SERVICE_MNEMONIC
}

async function createServiceWallet () {
  const { SparkWallet } = await import('@buildonspark/spark-sdk')
  const { wallet } = await SparkWallet.initialize({
    mnemonicOrSeed: sparkServiceMnemonic(),
    options: {
      network: SPARK_NETWORK
    }
  })
  return wallet
}

async function getServiceWallet ({ signal } = {}) {
  signal?.throwIfAborted()
  if (!serviceWalletPromise) {
    serviceWalletPromise = createServiceWallet().catch(err => {
      serviceWalletPromise = undefined
      throw err
    })
  }
  signal?.throwIfAborted()
  return await serviceWalletPromise
}

function invalidateServiceWallet () {
  serviceWalletPromise = undefined
}

export function sparkCreateLightningInvoiceArgs (
  { msats, description, descriptionHash, expiry },
  { identityPubkey }
) {
  if (!COMPRESSED_PUBKEY.test(identityPubkey)) {
    throw new Error('identity pubkey must be a compressed secp256k1 pubkey')
  }
  if (descriptionHash && !HEX_32.test(descriptionHash)) {
    throw new Error('description hash must be 64 hex chars')
  }

  return {
    // Spark accepts integer sats only; msatsToSats floors.
    // The receive pipeline tolerates <1000 msat shortfall, so this is safe for SN amounts.
    amountSats: msatsToSats(msats),
    expirySeconds: expiry,
    receiverIdentityPubkey: identityPubkey,
    ...(descriptionHash
      ? { descriptionHash }
      : { memo: description })
  }
}

export async function createInvoice (args, config, { signal } = {}) {
  signal?.throwIfAborted()
  const wallet = await getServiceWallet({ signal })
  signal?.throwIfAborted()

  let request
  try {
    request = await wallet.createLightningInvoice(sparkCreateLightningInvoiceArgs(args, config))
  } catch (err) {
    // connection-level failures poison the cached wallet; force re-init on next call.
    invalidateServiceWallet()
    throw err
  }

  signal?.throwIfAborted()
  const bolt11 = request?.invoice?.encodedInvoice

  if (!bolt11) {
    throw new Error('Spark did not return a bolt11 invoice')
  }

  return bolt11
}

export async function testCreateInvoice ({ identityPubkey }, opts) {
  return await createInvoice(
    { msats: 1000, description: 'SN test invoice', expiry: 1 },
    { identityPubkey },
    opts
  )
}
