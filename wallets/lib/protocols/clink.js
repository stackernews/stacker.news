import { clinkValidator } from '@/wallets/lib/validate'

// CLINK: Common Lightning Interface for Nostr Keys
// https://github.com/shocknet/CLINK/

export default {
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
}
