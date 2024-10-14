import { phoenixdSchema } from '@/lib/validate'

export const name = 'phoenixd'
export const walletType = 'PHOENIXD'
export const walletField = 'walletPhoenixd'
export const fieldValidation = phoenixdSchema

// configure wallet fields
export const fields = [
  {
    name: 'url',
    label: 'url',
    type: 'text'
  },
  {
    name: 'primaryPassword',
    label: 'primary password',
    type: 'password',
    optional: 'for sending',
    help: 'You can find the primary password as `http-password` in your phoenixd configuration file as mentioned [here](https://phoenix.acinq.co/server/api#security).',
    clientOnly: true,
    editable: false
  },
  {
    name: 'secondaryPassword',
    label: 'secondary password',
    type: 'password',
    optional: 'for receiving',
    help: 'You can find the secondary password as `http-password-limited-access` in your phoenixd configuration file as mentioned [here](https://phoenix.acinq.co/server/api#security).',
    serverOnly: true,
    editable: false
  }
]

// configure wallet card
export const card = {
  title: 'phoenixd',
  subtitle: 'use [phoenixd](https://phoenix.acinq.co/server) for payments',
  badges: ['send & receive']
}

// phoenixd::TODO
// set validation schema
