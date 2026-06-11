import { hexValidator, urlValidator } from '@/wallets/lib/validate'

// LNbits
// https://github.com/lnbits/lnbits

export default [
  {
    name: 'LNBITS',
    displayName: 'LNbits',
    send: true,
    fields: [
      {
        name: 'url',
        label: 'url',
        type: 'text',
        // send wallet: dialed by the user's browser, so private/LAN addresses are allowed
        validate: urlValidator('clearnet', { allowPrivate: true }),
        required: true,
        share: true
      },
      {
        name: 'apiKey',
        label: 'admin key',
        type: 'password',
        validate: hexValidator(32),
        required: true,
        encrypt: true
      }
    ],
    relationName: 'walletSendLNbits'
  },
  {
    name: 'LNBITS',
    displayName: 'LNbits',
    send: false,
    fields: [
      {
        name: 'url',
        label: 'url',
        type: 'text',
        validate: urlValidator('clearnet', 'tor'),
        required: true,
        share: true
      },
      {
        name: 'apiKey',
        type: 'password',
        label: 'invoice key',
        validate: hexValidator(32),
        required: true
      }
    ],
    relationName: 'walletRecvLNbits'
  }
]
