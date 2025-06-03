import protocols from '@/wallets/client/protocols'

function protocol (name) {
  return protocols.find(protocol => protocol.name === name)
}

export function protocolSendPayment ({ name }, args, config, opts) {
  return protocol(name).sendPayment(args, config, opts)
}

export function protocolTestSendPayment ({ name }, config, opts) {
  return protocol(name).testSendPayment(config, opts)
}
