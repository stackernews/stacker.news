import { certValidator, invoiceMacaroonValidator, socketValidator } from '@/wallets/lib/validate'

// LND gRPC API

export default {
  name: 'LND_GRPC',
  displayName: 'gRPC',
  send: false,
  fields: [
    {
      name: 'socket',
      label: 'socket',
      type: 'text',
      validate: socketValidator(),
      required: true
    },
    {
      name: 'macaroon',
      label: 'macaroon',
      type: 'password',
      validate: invoiceMacaroonValidator(),
      required: true
    },
    {
      name: 'cert',
      label: 'certificate',
      type: 'password',
      validate: certValidator(),
      required: false
    }
  ],
  relationName: 'walletRecvLNDGRPC'
}
