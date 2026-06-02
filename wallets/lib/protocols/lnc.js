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
        'We need `/lnrpc.Lightning/SendPaymentSync` to send payments. Add `/lnrpc.Lightning/ChannelBalance` to show balances.',
        'Create a budgeted account session:',
        '```litcli accounts create --balance <budget>```',
        '```litcli sessions add --type account --label <your label> --account_id <account_id>```',
        'Or create a custom session with explicit send and balance permissions:',
        '```litcli sessions add --type custom --label <your label> --uri /lnrpc.Lightning/SendPaymentSync --uri /lnrpc.Lightning/ChannelBalance```',
        'For a custom send-only session, omit `/lnrpc.Lightning/ChannelBalance`.',
        'Grab the `pairing_secret_mnemonic` from the output and paste it here.'
      ],
      validate: bip39Validator({ min: 2, max: 10 }),
      required: true,
      encrypt: true,
      hint: 'must allow SendPaymentSync; ChannelBalance optional',
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
