import protocols from '@/wallets/server/protocols'
import * as sparkMock from './spark-mock'

function protocol (name) {
  if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_SPARK_MOCK === '1' && name === 'SPARK') {
    return sparkMock
  }

  return protocols.find(protocol => protocol.name === name)
}

export function protocolCreateInvoice ({ name }, args, config, opts) {
  return protocol(name).createInvoice(args, config, opts)
}

export function protocolTestCreateInvoice ({ name }, config, opts) {
  return protocol(name).testCreateInvoice(config, opts)
}
