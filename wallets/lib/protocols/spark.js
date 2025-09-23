import { bip39Validator, identityPublicKeyValidator } from '@/wallets/lib/validate'
import { generateRandomPassphrase } from '@/wallets/lib/crypto'
import { SparkWallet } from '@buildonspark/spark-sdk'

// Spark
// https://spark.money/
// https://github.com/buildonspark/spark
// https://docs.spark.money/api-reference

export default [
  {
    name: 'SPARK',
    send: true,
    displayName: 'Spark',
    fields: [
      {
        name: 'mnemonic',
        label: 'mnemonic',
        type: 'password',
        required: true,
        validate: bip39Validator(),
        encrypt: true,
        initial: generateRandomPassphrase,
        disabled: true
      }
    ],
    relationName: 'walletSendSpark'
  },
  {
    name: 'SPARK',
    send: false,
    displayName: 'Spark',
    fields: [
      {
        name: 'identityPublicKey',
        label: 'identity public key',
        type: 'password',
        required: true,
        validate: identityPublicKeyValidator()
      }
    ],
    relationName: 'walletRecvSpark'
  }
]

export async function withSparkWallet (mnemonic, cb) {
  const { wallet } = await SparkWallet.initialize({
    mnemonicOrSeed: mnemonic,
    options: { network: 'MAINNET' }
  })
  try {
    return await cb(wallet)
  } finally {
    await wallet.cleanupConnections()
  }
}

export async function withRandomSparkWallet (cb) {
  return await withSparkWallet(undefined, cb)
}
