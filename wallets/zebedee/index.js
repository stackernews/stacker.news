import { string } from '@/lib/yup'

export const DASHBOARD_URL = 'https://dashboard.zebedee.io/'
export const API_URL = 'https://api.zebedee.io/v0/'

export const name = 'zebedee'
export const walletType = 'ZEBEDEE'
export const walletField = 'walletZebedee'

export const fields = [
  {
    name: 'apiKey',
    label: 'api key',
    type: 'password',
    optional: 'for sending',
    help: `you can get an API key from [Zebedee Dashboard](${DASHBOARD_URL}) from \n\`Project->API->Live\``,
    clientOnly: true,
    validate: string().min(8, 'invalid api key').max(64, 'api key is too long')
  }
]

export const card = {
  title: 'Zebedee',
  subtitle: 'use [Zebedee](https://zebedee.io) for payments',
  image: { src: '/wallets/zbd.svg' }
}
