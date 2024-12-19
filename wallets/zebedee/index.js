import { string } from '@/lib/yup'

export const PREIMAGE_AWAIT_TIMEOUT_MS = 1_200
export const STATIC_CHARGE_URL = 'https://api.zebedee.io/v0/process-static-charges/'
export const DASHBOARD_URL = 'https://dashboard.zebedee.io/'
export const GAMER_TAG_LNADDR_BASEURL = 'https://zbd.gg/.well-known/lnurlp/'
export const API_URL = 'https://api.zebedee.io/v0/'
export const ZEBEDEE_LNDOMAIN = 'zbd.gg'

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
    requiredWithout: 'gamerTagId',
    validate: string()
  },
  {
    name: 'gamerTagId',
    label: 'gamer tag or id',
    type: 'text',
    optional: 'for receiving',
    help: `you can find your Gamertag in the [Zebedee Dashboard](${DASHBOARD_URL}) under \n\`Account->Gamertag\`\n section, or in the Zebedee app on the Wallet card.\nNote: You can also use your \`@${ZEBEDEE_LNDOMAIN}\` Lightning address here.`,
    serverOnly: true,
    requiredWithout: 'apiKey',
    validate: string()
  }
]

export const card = {
  title: 'Zebedee',
  subtitle: 'use [Zebedee](https://zebedee.io) for payments',
  image: { src: '/wallets/zbd.svg' }

}
