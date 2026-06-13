import { GqlInputError } from '@/lib/error'

const BOLT11_NETWORKS = [
  { prefix: 'lnbcrt', name: 'regtest' },
  { prefix: 'lntbs', name: 'signet' },
  { prefix: 'lntb', name: 'testnet' },
  { prefix: 'lnbc', name: 'mainnet' }
]

export function bolt11Network (invoice) {
  if (typeof invoice !== 'string') return null

  const lower = invoice.toLowerCase()
  return BOLT11_NETWORKS.find(network => lower.startsWith(network.prefix)) ?? null
}

export function assertMatchingBolt11Networks (walletInvoice, stackerInvoice) {
  const walletNetwork = bolt11Network(walletInvoice)
  if (!walletNetwork) throw new GqlInputError('wallet returned invalid invoice')

  const stackerNetwork = bolt11Network(stackerInvoice)
  if (!stackerNetwork) throw new GqlInputError('SN node returned invalid invoice')

  if (walletNetwork.name !== stackerNetwork.name) {
    throw new GqlInputError(`wallet is on ${walletNetwork.name} but SN node is on ${stackerNetwork.name}`)
  }
}
