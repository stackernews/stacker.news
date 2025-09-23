import { bip39Validator, externalLightningAddressValidator } from '@/wallets/lib/validate'

// Spark
// https://github.com/breez/spark-sdk
// https://sdk-doc-spark.breez.technology/

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
        encrypt: true
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
        name: 'address',
        label: 'address',
        type: 'text',
        required: true,
        validate: externalLightningAddressValidator
      }
    ],
    relationName: 'walletRecvSpark'
  }
]
