import { hexValidator, urlValidator } from '@/wallets/lib/validate'

// Phoenixd
// https://phoenix.acinq.co/server

export default [
  {
    name: 'PHOENIXD',
    displayName: 'Phoenixd',
    send: true,
    fields: [
      {
        name: 'url',
        type: 'text',
        label: 'url',
        // send wallet: dialed by the user's browser, so private/LAN addresses are allowed
        validate: urlValidator('clearnet', { allowPrivate: true }),
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
    displayName: 'Phoenixd',
    send: false,
    fields: [
      {
        name: 'url',
        type: 'text',
        label: 'url',
        // receive wallet: dialed by our servers, which can reach onion via the Tor proxy
        validate: urlValidator('clearnet', 'tor'),
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
