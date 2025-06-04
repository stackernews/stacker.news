import { certValidator, runeValidator, socketValidator } from '@/wallets/lib//validate'

// Core Lightning REST API
// https://docs.corelightning.org/docs/rest

export default {
  name: 'CLN_REST',
  displayName: 'CLNRest',
  send: false,
  fields: [
    {
      name: 'socket',
      label: 'socket',
      type: 'text',
      required: true,
      validate: socketValidator()
    },
    {
      name: 'cert',
      label: 'certificate',
      type: 'password',
      validate: certValidator(),
      required: false
    },
    {
      name: 'rune',
      label: 'rune',
      type: 'password',
      validate: runeValidator({ method: 'invoice' }),
      required: true,
      hint: 'must be restricted to method=invoice'
    }
  ],
  relationName: 'walletRecvCLNRest'
}
