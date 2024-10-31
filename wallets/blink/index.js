import { string } from '@/lib/yup'

export const galoyBlinkUrl = 'https://api.blink.sv/graphql'
export const galoyBlinkDashboardUrl = 'https://dashboard.blink.sv/'

export const name = 'blink'
export const walletType = 'BLINK'
export const walletField = 'walletBlink'

export const fields = [
  {
    name: 'apiKey',
    label: 'api key',
    type: 'password',
    help: `you can get an API key from [Blink Dashboard](${galoyBlinkDashboardUrl})`,
    placeholder: 'blink_...',
    clientOnly: true,
    validate: string()
      .matches(/^blink_[A-Za-z0-9]+$/, { message: 'must match pattern blink_A-Za-z0-9' })
  },
  {
    name: 'currency',
    label: 'wallet type',
    type: 'text',
    help: 'the blink wallet to use (BTC or USD for stablesats)',
    placeholder: 'BTC',
    optional: true,
    clear: true,
    autoComplete: 'off',
    clientOnly: true,
    validate: string()
      .transform(value => value ? value.toUpperCase() : 'BTC')
      .oneOf(['USD', 'BTC'], 'must be BTC or USD')
  }
]

export const card = {
  title: 'Blink',
  subtitle: 'use [Blink](https://blink.sv/) for payments',
  badges: ['send only']
}
