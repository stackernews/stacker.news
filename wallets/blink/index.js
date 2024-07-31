import { blinkSchema } from '@/lib/validate'

export const galoyBlinkUrl = ''
export const galoyBlinkDashboardUrl = 'https://dashboard.blink.sv/'

export const name = 'blink'

export const fields = [
  {
    name: 'apiKey',
    label: 'api key',
    type: 'password',
    help: `you can get an API key from [Blink Dashboard](${galoyBlinkDashboardUrl})`,
    placeholder: 'blink_...'
  },
  {
    name: 'currency',
    label: 'wallet type',
    type: 'text',
    help: 'the blink wallet to use (BTC or USD for stable sats)',
    placeholder: 'BTC',
    optional: true,
    clear: true
  }
]

export const card = {
  title: 'Blink',
  subtitle: 'use [Blink](https://blink.sv/) for payments',
  badges: ['send only']
}

export const fieldValidation = blinkSchema
