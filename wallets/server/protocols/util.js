import protocols from '@/wallets/server/protocols'

function protocol (name) {
  return protocols.find(protocol => protocol.name === name)
}

export function protocolCreateInvoice ({ name }, args, config, opts) {
  return protocol(name).createInvoice(args, config, opts)
}

// the msats this protocol can actually invoice for a request
export function protocolReceivableMsats ({ name }, msats) {
  const p = protocol(name)
  return p.receivableMsats ? p.receivableMsats(msats) : BigInt(msats)
}

// the description this protocol can actually carry
export function protocolReceivableDescription ({ name }, description) {
  const p = protocol(name)
  return p.receivableDescription ? p.receivableDescription(description) : description
}

export function protocolTestCreateInvoice ({ name }, config, opts) {
  return protocol(name).testCreateInvoice(config, opts)
}
