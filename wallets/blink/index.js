import { blinkSchema } from '@/lib/validate'
import { galoyBlinkDashboardUrl } from 'wallets/blink/common'

export const name = 'blink'
export const walletType = 'BLINK'
export const walletField = 'walletBlink'
export const fieldValidation = blinkSchema

export const fields = [
  {
    name: 'apiKey',
    label: 'api key',
    type: 'password',
    help: `you can get an API key from [Blink Dashboard](${galoyBlinkDashboardUrl}).\nPlease make sure to select ONLY the 'Read' and 'Write' scopes when generating this API key.`,
    placeholder: 'blink_...',
    optional: 'for sending',
    clientOnly: true,
    editable: false
  },
  {
    name: 'currency',
    label: 'wallet type',
    type: 'text',
    help: 'the blink wallet to use for sending (BTC or USD for stablesats)',
    placeholder: 'BTC',
    clear: true,
    autoComplete: 'off',
    optional: 'for sending',
    clientOnly: true,
    editable: false
  },
  {
    name: 'apiKeyRecv',
    label: 'api key',
    type: 'password',
    help: `you can get an API key from [Blink Dashboard](${galoyBlinkDashboardUrl}).\nPlease make sure to select ONLY the 'Read' and 'Receive' scopes when generating this API key.`,
    placeholder: 'blink_...',
    optional: 'for receiving',
    serverOnly: true,
    editable: false
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
    editable: false

  }
]

export const card = {
  title: 'Blink',
  subtitle: 'use [Blink](https://blink.sv/) for payments',
  badges: ['send & receive']
}
