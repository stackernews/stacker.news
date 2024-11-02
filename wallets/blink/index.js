import { string } from '@/lib/yup'
import { galoyBlinkDashboardUrl } from 'wallets/blink/common'

export const name = 'blink'
export const walletType = 'BLINK'
export const walletField = 'walletBlink'

export const fields = [
  {
    name: 'apiKey',
    label: 'api key',
    type: 'password',
    placeholder: 'blink_...',
    clientOnly: true,
    validate: string()
      .matches(/^blink_[A-Za-z0-9]+$/, { message: 'must match pattern blink_A-Za-z0-9' }),
    help: `you can get an API key from [Blink Dashboard](${galoyBlinkDashboardUrl}).\nPlease make sure to select ONLY the 'Read' and 'Write' scopes when generating this API key.`,
    optional: 'for sending',
    requiredWithout: ['apiKeyRecv']
  },
  {
    name: 'currency',
    label: 'wallet type',
    type: 'text',
    help: 'the blink wallet to use for sending (BTC or USD for stablesats)',
    placeholder: 'BTC',
    clear: true,
    autoComplete: 'off',
    clientOnly: true,
    validate: string()
      .transform(value => value ? value.toUpperCase() : 'BTC')
      .oneOf(['USD', 'BTC'], 'must be BTC or USD'),
    optional: 'for sending'
  },
  {
    name: 'apiKeyRecv',
    label: 'api key',
    type: 'password',
    help: `you can get an API key from [Blink Dashboard](${galoyBlinkDashboardUrl}).\nPlease make sure to select ONLY the 'Read' and 'Receive' scopes when generating this API key.`,
    placeholder: 'blink_...',
    optional: 'for receiving',
    serverOnly: true,
    requiredWithout: ['apiKey'],
    validate: string()
      .matches(/^blink_[A-Za-z0-9]+$/, { message: 'must match pattern blink_A-Za-z0-9' })
  },
  {
    name: 'currencyRecv',
    label: 'wallet type',
    type: 'text',
    help: 'the blink wallet to use for receiving (only BTC available)',
    value: 'BTC',
    clear: true,
    autoComplete: 'off',
    optional: 'for receiving',
    serverOnly: true,
    validate: string()
      .transform(value => value ? value.toUpperCase() : 'BTC')
      .oneOf(['BTC'], 'must be BTC')
  }
]

export const card = {
  title: 'Blink',
  subtitle: 'use [Blink](https://blink.sv/) for payments',
  badges: ['send', 'receive']
}
