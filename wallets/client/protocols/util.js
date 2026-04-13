import protocols from '@/wallets/client/protocols'

function protocol (name) {
  return protocols.find(protocol => protocol.name === name)
}

export function protocolTestSendPayment ({ name }, config, opts) {
  return protocol(name).testSendPayment(config, opts)
}

export function protocolPrepareConfig (protocolInfo, config, opts) {
  return protocol(protocolInfo.name)?.prepareConfig?.(protocolInfo, config, opts)
}
