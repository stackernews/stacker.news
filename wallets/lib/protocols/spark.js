import { bip39Validator } from '@/wallets/lib/validate'
import { string } from 'yup'

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
        validate: bip39Validator(),
        encrypt: true,
        editable: false
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
        editable: false
      }
    ],
    relationName: 'walletRecvSpark'
  }
]
