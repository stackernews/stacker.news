import protocols from '@/wallets/client/protocols'
import * as sparkMock from './spark-mock'

function protocol (name) {
  if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_SPARK_MOCK === '1' && name === 'SPARK') {
    return sparkMock
  }

  return protocols.find(protocol => protocol.name === name)
}

export function protocolSendPayment ({ name }, args, config, opts) {
  return protocol(name).sendPayment(args, config, opts)
}

export function protocolTestSendPayment ({ name }, config, opts) {
  return protocol(name).testSendPayment(config, opts)
}

export function protocolPrepareConfig (protocolInfo, config, opts) {
  return protocol(protocolInfo.name)?.prepareConfig?.(protocolInfo, config, opts)
}
