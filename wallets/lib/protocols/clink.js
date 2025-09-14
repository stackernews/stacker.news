import { clinkValidator } from '@/wallets/lib/validate'

// CLINK: Common Lightning Interface for Nostr Keys
// https://github.com/shocknet/CLINK/

export default [
  {
    name: 'CLINK',
    displayName: 'CLINK',
    send: false,
    fields: [
      {
        name: 'noffer',
        label: 'noffer',
        type: 'password',
        placeholder: 'noffer...',
        required: true,
        validate: clinkValidator('noffer')
      }
    ],
    relationName: 'walletRecvClink'
  },
  {
    name: 'CLINK',
    displayName: 'CLINK',
    send: true,
    fields: [
      {
        name: 'ndebit',
        label: 'ndebit',
        type: 'password',
        placeholder: 'ndebit...',
        required: true,
        validate: clinkValidator('ndebit'),
        encrypt: true
      }
    ],
    relationName: 'walletSendClink'
  }
]
