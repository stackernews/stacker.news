import { bip39Validator } from '@/wallets/lib/validate'

// Lightning Node Connect
// https://github.com/lightninglabs/lightning-node-connect

export default {
  name: 'LNC',
  displayName: 'Lightning Node Connect',
  send: true,
  fields: [
    {
      name: 'pairingPhrase',
      label: 'pairing phrase',
      type: 'password',
      validate: bip39Validator(),
      required: true,
      encrypt: true
    },
    // TODO(wallet-v2): generate these values during save
    {
      name: 'serverHost',
      encrypt: true
    },
    {
      name: 'localKey',
      encrypt: true
    },
    {
      name: 'remoteKey',
      encrypt: true
    }
  ],
  relationName: 'walletSendLNC'
}
