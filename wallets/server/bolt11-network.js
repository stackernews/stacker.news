import { parsePaymentRequest } from 'ln-service'
import { WalletValidationError } from '@/wallets/client/errors'

export function bolt11Network (request, label = 'wallet') {
  try {
    const { network } = parsePaymentRequest({ request })
    if (!network) throw new Error('missing network')
    return network
  } catch {
    throw new WalletValidationError(`${label} returned invalid invoice`)
  }
}

export function assertSameBolt11Network ({ actual, expected }) {
  const actualNetwork = bolt11Network(actual, 'wallet')
  const expectedNetwork = bolt11Network(expected, 'local wallet')

  if (actualNetwork !== expectedNetwork) {
    throw new WalletValidationError(`wallet invoice network mismatch: expected ${expectedNetwork}, got ${actualNetwork}`)
  }
}
