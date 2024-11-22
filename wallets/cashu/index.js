import { string } from '@/lib/yup'

export const DEFAULT_CASHU_RELAYS = [
  'wss://nostr.rblb.it:7777',
  'wss://relay.primal.net',
  'wss://relay.notoshi.win'
]

export const DEFAULT_CASHU_MINTS = [
  'https://mint.lnw.cash'
]

export const name = 'cashu'
export const walletType = 'CASHU'
export const walletField = 'walletCASHU'

export const fields = [
  {
    name: 'walletName',
    label: 'wallet name',
    type: 'text',
    placeholder: 'stacker.news-cashu',
    clientOnly: true,
    validate: string(),
    help: 'The name of the cashu wallet to use.'
  },
  {
    name: 'relays',
    label: 'relays',
    type: 'text',
    help: 'a comma-separated list of relays to use',
    placeholder: 'wss://nostr.rblb.it:7777',
    defaultValue: DEFAULT_CASHU_RELAYS.join(','),
    clear: true,
    clientOnly: true,
    validate: string()
  },
  {
    name: 'mints',
    label: 'mints',
    type: 'text',
    help: 'a comma-separated list of mints to use',
    defaultValue: DEFAULT_CASHU_MINTS.join(','),
    placeholder: 'blink_...',
    clear: true,
    clientOnly: true,
    validate: string()
  },
  {
    name: 'privKey',
    label: 'wallet nostr private key',
    type: 'text',
    help: 'the nostr private key to use for the wallet',
    placeholder: 'nsec...',
    clear: true,
    clientOnly: true,
    optional: 'if unset the browser extension will be used',
    validate: string()
  }
]

export const card = {
  title: 'Cashu',
  subtitle: 'Cashu over nostr NIP-60',
  badges: ['send']
}
