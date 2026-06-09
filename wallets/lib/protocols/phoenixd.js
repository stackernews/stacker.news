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
        required: true,
        share: true
      },
      {
        name: 'apiKey',
        type: 'password',
        label: 'api key',
        help: [
          'The primary password can be found as `http-password` in your phoenixd configuration file.',
          'The default location is ~/.phoenix/phoenix.conf.',
          'Read the [official documentation](https://phoenix.acinq.co/server/api#security) for more details.'
        ],
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
        required: true,
        share: true
      },
      {
        name: 'apiKey',
        type: 'password',
        label: 'api key',
        help: [
          'The secondary password can be found as `http-password-limited-access` in your phoenixd configuration file.',
          'The default location is ~/.phoenix/phoenix.conf.',
          'Read the [official documentation](https://phoenix.acinq.co/server/api#security) for more details.'
        ],
        validate: hexValidator(64),
        required: true
      }
    ],
    relationName: 'walletRecvPhoenixd'
  }
]
