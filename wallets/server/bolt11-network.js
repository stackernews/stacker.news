import { GqlInputError } from '@/lib/error'

const BOLT11_NETWORKS = [
  { prefix: 'lnbcrt', name: 'regtest' },
  { prefix: 'lntbs', name: 'signet' },
  { prefix: 'lntb', name: 'testnet' },
  { prefix: 'lnbc', name: 'mainnet' }
]

const BOLT11_NETWORK_ALIASES = new Map([
  ['mainnet', 'mainnet'],
  ['bitcoin', 'mainnet'],
  ['bc', 'mainnet'],
  ['lnbc', 'mainnet'],
  ['testnet', 'testnet'],
  ['tb', 'testnet'],
  ['lntb', 'testnet'],
  ['signet', 'signet'],
  ['tbs', 'signet'],
  ['lntbs', 'signet'],
  ['regtest', 'regtest'],
  ['bcrt', 'regtest'],
  ['lnbcrt', 'regtest']
])

export function bolt11Network (invoice) {
  if (typeof invoice !== 'string') return null

  const lower = invoice.toLowerCase()
  return BOLT11_NETWORKS.find(network => lower.startsWith(network.prefix)) ?? null
}

export function bolt11NetworkForName (networkName) {
  if (typeof networkName !== 'string') return null

  const normalized = networkName.trim().toLowerCase()
  const name = BOLT11_NETWORK_ALIASES.get(normalized)
  return BOLT11_NETWORKS.find(network => network.name === name) ?? null
}

export function stackerBolt11Network (env = process.env) {
  const configuredNetwork = env.LNCLI_NETWORK ?? env.LIGHTNING_NETWORK ?? env.BITCOIN_NETWORK
  if (configuredNetwork) return bolt11NetworkForName(configuredNetwork)

  return env.NODE_ENV === 'development'
    ? bolt11NetworkForName('regtest')
    : bolt11NetworkForName('mainnet')
}

export function assertWalletInvoiceNetwork (walletInvoice, stackerNetwork = stackerBolt11Network()) {
  const walletNetwork = bolt11Network(walletInvoice)
  if (!walletNetwork) throw new GqlInputError('wallet returned invalid invoice')
  if (!stackerNetwork) throw new GqlInputError('SN node network is invalid')

  if (walletNetwork.name !== stackerNetwork.name) {
    throw new GqlInputError(`wallet is on ${walletNetwork.name} but SN node is on ${stackerNetwork.name}`)
  }
}
