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
      help: [
        'We only need permissions for the uri `/lnrpc.Lightning/SendPaymentSync`.',
        'Create a budgeted account with narrow permissions:',
        '```litcli accounts create --balance <budget>```',
        '```litcli sessions add --type custom --label <your label> --account_id <account_id> --uri /lnrpc.Lightning/SendPaymentSync```',
        'Grab the `pairing_secret_mnemonic` from the output and paste it here.'
      ],
      validate: bip39Validator({ min: 2, max: 10 }),
      required: true,
      encrypt: true,
      editable: false
    },
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
