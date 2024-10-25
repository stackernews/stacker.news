import { string } from '@/lib/yup'

export const name = 'phoenixd'
export const walletType = 'PHOENIXD'
export const walletField = 'walletPhoenixd'

// configure wallet fields
export const fields = [
  {
    name: 'url',
    label: 'url',
    type: 'text',
    validate: string().url().trim()
  },
  {
    name: 'primaryPassword',
    label: 'primary password',
    type: 'password',
    optional: 'for sending',
    help: 'You can find the primary password as `http-password` in your phoenixd configuration file as mentioned [here](https://phoenix.acinq.co/server/api#security).',
    clientOnly: true,
    requiredWithout: 'secondaryPassword',
    validate: string().length(64).hex()
  },
  {
    name: 'secondaryPassword',
    label: 'secondary password',
    type: 'password',
    optional: 'for receiving',
    help: 'You can find the secondary password as `http-password-limited-access` in your phoenixd configuration file as mentioned [here](https://phoenix.acinq.co/server/api#security).',
    serverOnly: true,
    requiredWithout: 'primaryPassword',
    validate: string().length(64).hex()
  }
]

// configure wallet card
export const card = {
  title: 'phoenixd',
  subtitle: 'use [phoenixd](https://phoenix.acinq.co/server) for payments',
  badges: ['send & receive']
}
