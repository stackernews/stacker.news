export class InvoiceCanceledError extends Error {
  constructor (hash, actionError) {
    super(actionError ?? `invoice canceled: ${hash}`)
    this.name = 'InvoiceCanceledError'
    this.hash = hash
    this.actionError = actionError
  }
}

export class InvoiceExpiredError extends Error {
  constructor (hash) {
    super(`invoice expired: ${hash}`)
    this.name = 'InvoiceExpiredError'
  }
}

export class WalletNotEnabledError extends Error {
  constructor (name) {
    super(`wallet is not enabled: ${name}`)
    this.name = 'WalletNotEnabledError'
  }
}

export class SenderError extends Error {
  constructor (name, invoice, message) {
    super(`${name} failed to pay invoice ${invoice.hash}: ${message}`)
    this.name = 'SenderError'
    this.invoice = invoice
  }
}

export class WalletAggregateError extends AggregateError {
  constructor (errors, newInvoice) {
    super(errors)
    this.name = 'WalletAggregateError'
    this.newInvoice = newInvoice
  }
}

export class NoWalletAvailableError extends Error {
  constructor () {
    super('no wallet for payments available')
    this.name = 'NoWalletAvailableError'
  }
}
