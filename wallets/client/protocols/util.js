import { loadProtocol } from './registry'

export async function protocolSendPayment ({ name }, args, config, opts) {
  return (await loadProtocol(name)).sendPayment(args, config, opts)
}

export async function protocolTestSendPayment ({ name }, config, opts) {
  return (await loadProtocol(name)).testSendPayment(config, opts)
}
