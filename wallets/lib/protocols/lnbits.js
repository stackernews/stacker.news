import { hexValidator, urlValidator } from '@/wallets/lib/validate'

// LNbits
// https://github.com/lnbits/lnbits

export default [
  {
    name: 'LNBITS',
    displayName: 'API',
    send: true,
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
    displayName: 'API',
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
