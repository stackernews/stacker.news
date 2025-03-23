export class InvoiceCanceledError extends Error {
  constructor (invoice, actionError) {
    super(actionError ?? `invoice canceled: ${invoice.hash}`)
    this.name = 'InvoiceCanceledError'
    this.invoice = invoice
    this.actionError = actionError
  }
}

export class InvoiceExpiredError extends Error {
  constructor (invoice) {
    super(`invoice expired: ${invoice.hash}`)
    this.name = 'InvoiceExpiredError'
    this.invoice = invoice
  }
}

export class WalletError extends Error {}
export class WalletPaymentError extends WalletError {}
export class WalletConfigurationError extends WalletError {}

export class WalletNotEnabledError extends WalletConfigurationError {
  constructor (name) {
    super(`wallet is not enabled: ${name}`)
    this.name = 'WalletNotEnabledError'
    this.wallet = name
    this.reason = 'wallet is not enabled'
  }
}

export class WalletSendNotConfiguredError extends WalletConfigurationError {
  constructor (name) {
    super(`wallet send is not configured: ${name}`)
    this.name = 'WalletSendNotConfiguredError'
    this.wallet = name
    this.reason = 'wallet send is not configured'
  }
}

export class WalletSenderError extends WalletPaymentError {
  constructor (name, invoice, message) {
    super(`${name} failed to pay invoice ${invoice.hash}: ${message}`)
    this.name = 'WalletSenderError'
    this.wallet = name
    this.invoice = invoice
    this.reason = message
  }
}

export class WalletReceiverError extends WalletPaymentError {
  constructor (invoice) {
    super(`payment forwarding failed for invoice ${invoice.hash}`)
    this.name = 'WalletReceiverError'
    this.invoice = invoice
  }
}

export class WalletsNotAvailableError extends WalletConfigurationError {
  constructor () {
    super('no wallet available')
    this.name = 'WalletsNotAvailableError'
  }
}

export class AnonWalletError extends WalletConfigurationError {
  constructor () {
    super('anon cannot pay with wallets')
    this.name = 'AnonWalletError'
  }
}

export class WalletAggregateError extends WalletError {
  constructor (errors, invoice) {
    super('WalletAggregateError')
    this.name = 'WalletAggregateError'
    this.errors = errors.reduce((acc, e) => {
      if (Array.isArray(e?.errors)) {
        acc.push(...e.errors)
      } else {
        acc.push(e)
      }
      return acc
    }, [])
    this.invoice = invoice
  }
}

export class WalletPaymentAggregateError extends WalletPaymentError {
  constructor (errors, invoice) {
    super('WalletPaymentAggregateError')
    this.name = 'WalletPaymentAggregateError'
    this.errors = errors.reduce((acc, e) => {
      if (Array.isArray(e?.errors)) {
        acc.push(...e.errors)
      } else {
        acc.push(e)
      }
      return acc
    }, []).filter(e => e instanceof WalletPaymentError)
    this.invoice = invoice
  }
}
