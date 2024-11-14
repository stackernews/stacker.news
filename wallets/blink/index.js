import { string } from '@/lib/yup'
import { galoyBlinkDashboardUrl } from '@/wallets/blink/common'

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
    requiredWithout: 'apiKeyRecv',
    optional: 'for sending'
  },
  {
    name: 'currency',
    label: 'wallet type',
    type: 'text',
    help: 'the blink wallet to use for sending (BTC or USD for stablesats)',
    placeholder: 'BTC',
    defaultValue: 'BTC',
    clear: true,
    autoComplete: 'off',
    clientOnly: true,
    validate: string()
      .transform(value => value ? value.toUpperCase() : 'BTC')
      .oneOf(['USD', 'BTC'], 'must be BTC or USD'),
    optional: 'for sending',
    requiredWithout: 'currencyRecv'
  },
  {
    name: 'apiKeyRecv',
    label: 'receive api key',
    type: 'password',
    help: `you can get an API key from [Blink Dashboard](${galoyBlinkDashboardUrl}).\nPlease make sure to select ONLY the 'Read' and 'Receive' scopes when generating this API key.`,
    placeholder: 'blink_...',
    serverOnly: true,
    validate: string()
      .matches(/^blink_[A-Za-z0-9]+$/, { message: 'must match pattern blink_A-Za-z0-9' }),
    optional: 'for receiving',
    requiredWithout: 'apiKey'
  },
  {
    name: 'currencyRecv',
    label: 'receive wallet type',
    type: 'text',
    help: 'the blink wallet to use for receiving (only BTC available)',
    defaultValue: 'BTC',
    clear: true,
    autoComplete: 'off',
    placeholder: 'BTC',
    serverOnly: true,
    validate: string()
      .transform(value => value ? value.toUpperCase() : 'BTC')
      .oneOf(['BTC'], 'must be BTC'),
    optional: 'for receiving',
    requiredWithout: 'currency'
  }
]

export const card = {
  title: 'Blink',
  subtitle: 'use [Blink](https://blink.sv/) for payments',
  badges: ['send', 'receive']
}
