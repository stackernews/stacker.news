import protocols from '@/wallets/server/protocols'
import { WalletVerificationUnsupportedError } from '@/wallets/lib/errors'
import { checkLnurlVerifyInvoice } from './lnurlVerify'

function protocol (name) {
  return protocols.find(protocol => protocol.name === name)
}

export function protocolCreateInvoice ({ name }, args, config, opts) {
  return normalizeCreateInvoiceResult(protocol(name).createInvoice(args, config, opts))
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
  if (typeof invoice === 'string') return { bolt11: invoice }
  if (invoice && typeof invoice.bolt11 === 'string') return invoice
  throw new Error('wallet returned invalid invoice')
}

function invoiceChecker (walletProtocol, transaction) {
  const native = walletProtocol && protocol(walletProtocol.name)?.checkInvoice
  if (typeof native === 'function') return native
  if (transaction?.verificationContext?.lnurlVerifyUrl) return checkLnurlVerifyInvoice
}
