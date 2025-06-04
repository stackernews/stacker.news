import { hexValidator, urlValidator } from '@/wallets/lib/validate'

// Phoenixd
// https://phoenix.acinq.co/server

export default [
  {
    name: 'PHOENIXD',
    displayName: 'API',
    send: true,
    fields: [
      {
        name: 'url',
        type: 'text',
        label: 'url',
        validate: urlValidator('clearnet'),
        required: true
      },
      {
        name: 'apiKey',
        type: 'password',
        label: 'api key',
        validate: hexValidator(64),
        required: true,
        encrypt: true
      }
    ],
    relationName: 'walletSendPhoenixd'
  },
  {
    name: 'PHOENIXD',
    displayName: 'API',
    send: false,
    fields: [
      {
        name: 'url',
        type: 'text',
        label: 'url',
        validate: urlValidator('clearnet'),
        required: true
      },
      {
        name: 'apiKey',
        type: 'password',
        label: 'api key',
        validate: hexValidator(64),
        required: true
      }
    ],
    relationName: 'walletRecvPhoenixd'
  }
]
