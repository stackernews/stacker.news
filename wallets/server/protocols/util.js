import protocols from '@/wallets/server/protocols'

function protocol (name) {
  return protocols.find(protocol => protocol.name === name)
}

export function protocolCreateInvoice ({ name }, args, config, opts) {
  return normalizeCreateInvoiceResult(protocol(name).createInvoice(args, config, opts))
}

export function protocolCheckInvoice ({ name }, transaction, config, opts) {
  return protocol(name).checkInvoice?.(transaction, config, opts) ?? null
}

// whether this protocol can verify a receive's settlement at all (noffer/CLINK cannot)
export function protocolCanCheckInvoice ({ name }) {
  return typeof protocol(name).checkInvoice === 'function'
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

export async function protocolTestCreateInvoice ({ name }, config, opts) {
  return (await normalizeCreateInvoiceResult(protocol(name).testCreateInvoice(config, opts))).bolt11
}

async function normalizeCreateInvoiceResult (result) {
  const invoice = await result
  if (typeof invoice === 'string') return { bolt11: invoice }
  if (invoice && typeof invoice.bolt11 === 'string') return invoice
  throw new Error('wallet returned invalid invoice')
}
