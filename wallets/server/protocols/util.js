import protocols from '@/wallets/server/protocols'

function protocol (name) {
  return protocols.find(protocol => protocol.name === name)
}

export function protocolCreateInvoice ({ name }, args, config, opts) {
  return protocol(name).createInvoice(args, config, opts)
}

export function protocolTestCreateInvoice ({ name }, config, opts) {
  return protocol(name).testCreateInvoice(config, opts)
}
