import protocols from '@/wallets/server/protocols'
import { WalletVerificationUnsupportedError } from '@/wallets/lib/errors'
import { assertValidBolt11, logInvalidBolt11 } from '@/lib/bolt11-validator'
import { checkLnurlVerifyInvoice } from './lnurlVerify'

function protocol (name) {
  return protocols.find(protocol => protocol.name === name)
}

export function protocolCreateInvoice ({ name }, args, config, opts) {
  return normalizeCreateInvoiceResult(protocol(name).createInvoice(args, config, opts))
}

export function protocolSupportsDescriptionHash ({ name }) {
  return protocol(name)?.supportsDescriptionHash === true
}

export function protocolCheckInvoice (walletProtocol, transaction, config, opts) {
  const checkInvoice = invoiceChecker(walletProtocol, transaction)
  if (!checkInvoice) {
    throw new WalletVerificationUnsupportedError('wallet protocol does not support invoice status verification')
  }
  return checkInvoice(transaction, config, opts)
}

export function protocolHasInvoiceChecker (walletProtocol, transaction) {
  return !!invoiceChecker(walletProtocol, transaction)
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
  const normalized = typeof invoice === 'string'
    ? { bolt11: invoice }
    : (invoice && typeof invoice.bolt11 === 'string' ? invoice : null)
  if (!normalized) throw new Error('wallet returned invalid invoice')

  // injecting synctactic validation here catches all wallet calls
  try {
    assertValidBolt11(normalized.bolt11)
  } catch (err) {
    logInvalidBolt11('refusing to process invoice returned from wallet', err)
    throw new Error(`wallet returned invalid invoice: ${err.message}`)
  }

  return normalized
}

function invoiceChecker (walletProtocol, transaction) {
  const native = walletProtocol && protocol(walletProtocol.name)?.checkInvoice
  if (typeof native === 'function') return native
  if (transaction?.verificationContext?.lnurlVerifyUrl) return checkLnurlVerifyInvoice
}
