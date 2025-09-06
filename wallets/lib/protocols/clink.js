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
        type: 'text',
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
        type: 'text',
        placeholder: 'ndebit...',
        required: true,
        validate: clinkValidator('ndebit')
      }
    ],
    relationName: 'walletSendClink'
  }
]
