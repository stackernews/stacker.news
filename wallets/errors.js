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

export class WalletError extends Error {}
export class WalletPaymentError extends WalletError {}
export class WalletConfigurationError extends WalletError {}

export class WalletNotEnabledError extends WalletConfigurationError {
  constructor (name) {
    super(`wallet is not enabled: ${name}`)
    this.name = 'WalletNotEnabledError'
  }
}

export class WalletSendNotConfiguredError extends WalletConfigurationError {
  constructor (name) {
    super(`wallet send is not configured: ${name}`)
    this.name = 'WalletSendNotConfiguredError'
  }
}

export class WalletSenderError extends WalletPaymentError {
  constructor (name, invoice, message) {
    super(`${name} failed to pay invoice ${invoice.hash}: ${message}`)
    this.name = 'WalletSenderError'
    this.invoice = invoice
  }
}

export class WalletsNotAvailableError extends WalletConfigurationError {
  constructor () {
    super('no wallet available')
    this.name = 'WalletsNotAvailableError'
  }
}

export class WalletAggregateError extends WalletError {
  constructor (errors, newInvoice) {
    super('WalletAggregateError')
    this.name = 'WalletAggregateError'
    this.errors = errors
    this.newInvoice = newInvoice
  }
}
