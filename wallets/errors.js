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
  constructor (name, hash) {
    super(`${name} failed to pay invoice: ${hash}`)
    this.name = 'WalletPaymentFailedError'
  }
}

export class WalletAggregateError extends AggregateError {
  constructor (errors) {
    super(errors)
    this.name = 'WalletAggregateError'
  }
}

export class NoWalletAvailableError extends Error {
  constructor () {
    super('no wallet for payments available')
    this.name = 'NoWalletAvailableError'
  }
}
