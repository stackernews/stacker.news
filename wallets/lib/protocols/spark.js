import { bip39Validator } from '@/wallets/lib/validate'
import { walletAmountToMsatsOrUndefined } from '@/wallets/lib/amount'
import { raceAbort } from '@/lib/time'
import { string } from 'yup'

export const SPARK_NETWORK = process.env.NODE_ENV === 'production' ? 'MAINNET' : 'REGTEST'

const identityPubkeyValidator = string()
  .trim()
  .matches(/^0[23][0-9a-fA-F]{64}$/, 'must be a compressed secp256k1 pubkey')

export default [
  {
    name: 'SPARK',
    displayName: 'Spark',
    send: true,
    fields: [
      {
        name: 'mnemonic',
        type: 'password',
        label: 'mnemonic',
        required: true,
        validate: bip39Validator({ checksum: true }),
        encrypt: true,
        generated: true
      }
    ],
    relationName: 'walletSendSpark'
  },
  {
    name: 'SPARK',
    displayName: 'Spark',
    send: false,
    fields: [
      {
        name: 'identityPubkey',
        type: 'text',
        label: 'identity pubkey',
        required: true,
        validate: identityPubkeyValidator,
        generated: true
      }
    ],
    relationName: 'walletRecvSpark'
  }
]

export function sparkCurrencyAmountToMsats (amount) {
  let walletAmount
  if (amount?.originalValue != null) {
    if (amount.originalUnit === 'MILLISATOSHI') walletAmount = { msat: amount.originalValue }
    if (amount.originalUnit === 'SATOSHI') walletAmount = { sat: amount.originalValue }
  }
  const msats = walletAmountToMsatsOrUndefined(walletAmount)
  return msats == null ? undefined : String(msats)
}

// Spark starts background work before opening can reject, but the SDK
// does not expose the partially initialized wallet for cleanup. Since its
// static opener constructs `this`, a subclass lets us retain and clean it.
export async function openSparkWallet (props = {}, { signal, reuse = false } = {}) {
  const { SparkWallet } = await raceAbort(import('@buildonspark/spark-sdk'), signal)
  const walletProps = {
    ...props,
    options: { ...props.options, network: SPARK_NETWORK }
  }
  let wallet
  let stopped = false

  class TrackedSparkWallet extends SparkWallet {
    constructor (...args) {
      super(...args)
      wallet = this
    }

    cleanup (...args) {
      stopped = true
      return super.cleanup(...args)
    }

    setupBackgroundStream (...args) {
      if (stopped) return
      return super.setupBackgroundStream(...args)
    }
  }

  const cleanup = async () => {
    try {
      await wallet?.cleanup()
    } catch {}
  }
  let opening

  try {
    opening = reuse
      ? TrackedSparkWallet.getOrCreateWallet(walletProps)
      : TrackedSparkWallet.initialize(walletProps)
    return await raceAbort(opening, signal)
  } catch (err) {
    cleanup()
    // SDK initialization is not cancellable. Clean the candidate again after
    // any resources or singleton registration created after the first cleanup.
    if (signal?.aborted && opening) opening.finally(cleanup).catch(() => {})
    throw err
  }
}
