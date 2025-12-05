import { externalLightningAddressValidator } from '@/wallets/lib/validate'

// Lightning Address (LUD-16)
// https://github.com/lnurl/luds/blob/luds/16.md

export default {
  name: 'LN_ADDR',
  displayName: 'Lightning Address',
  send: false,
  fields: [
    {
      name: 'address',
      label: 'address',
      type: 'text',
      required: true,
      validate: externalLightningAddressValidator
    }
  ],
  relationName: 'walletRecvLightningAddress'
}
