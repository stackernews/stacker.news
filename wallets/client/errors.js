export class InvoiceError extends Error {
  constructor (invoice, message) {
    super(message)
    this.name = 'InvoiceError'
    this.invoice = invoice
  }
}

export class InvoiceCanceledError extends InvoiceError {
  constructor (invoice, actionError) {
    super(invoice, actionError ?? `invoice canceled: ${invoice?.hash}`)
    this.name = 'InvoiceCanceledError'
    this.actionError = actionError
  }
}

export class InvoiceExpiredError extends InvoiceError {
  constructor (invoice) {
    super(invoice, `invoice expired: ${invoice.hash}`)
    this.name = 'InvoiceExpiredError'
  }
}

export class WalletError extends Error {}
export class WalletPaymentError extends WalletError {}
export class WalletConfigurationError extends WalletError {}
export class WalletValidationError extends WalletError {}
export class WalletBalanceProbeSkipped extends WalletError {}

export class WalletSenderError extends WalletPaymentError {
  constructor (name, invoice, message, { cause } = {}) {
    super(`${name} failed to pay invoice ${invoice.hash}: ${message}`, { cause })
    this.name = 'WalletSenderError'
    this.wallet = name
    this.invoice = invoice
    this.reason = message
    // settledUnknown is owned by sendWalletPayment, which assigns it at the sole
    // construction site based on what the cause proves about the payment outcome.
  }
}

export class WalletReceiverError extends WalletPaymentError {
  constructor (invoice) {
    super(`payment forwarding failed for invoice ${invoice.hash}`)
    this.name = 'WalletReceiverError'
    this.invoice = invoice
  }
}

// the wallet/provider reported the payment terminally failed: it is safe to retry.
// adapters throw this only where the provider itself says FAILED — anything less
// is classified as settled-unknown by sendWalletPayment.
export class WalletPaymentRejectedError extends WalletPaymentError {
  constructor (message) {
    super(message)
    this.name = 'WalletPaymentRejectedError'
  }
}

export class WalletsNotAvailableError extends WalletConfigurationError {
  constructor () {
    super('no wallet available')
    this.name = 'WalletsNotAvailableError'
  }
}

export class WalletSendStateNotReadyError extends WalletConfigurationError {
  constructor () {
    super('wallet send state is not ready')
    this.name = 'WalletSendStateNotReadyError'
  }
}

export class AnonWalletError extends WalletConfigurationError {
  constructor () {
    super('anon cannot pay with wallets')
    this.name = 'AnonWalletError'
  }
}

function flattenWalletErrors (errors) {
  return errors.reduce((acc, e) => {
    if (Array.isArray(e?.errors)) {
      acc.push(...e.errors)
    } else {
      acc.push(e)
    }
    return acc
  }, [])
}

export class WalletAggregateError extends WalletError {
  constructor (errors, invoice) {
    super('WalletAggregateError')
    this.name = 'WalletAggregateError'
    this.errors = flattenWalletErrors(errors)
    this.invoice = invoice
  }
}

export class WalletPaymentAggregateError extends WalletPaymentError {
  constructor (errors, invoice) {
    super('WalletPaymentAggregateError')
    this.name = 'WalletPaymentAggregateError'
    this.errors = flattenWalletErrors(errors).filter(e => e instanceof WalletPaymentError)
    this.invoice = invoice
  }
}

export class WalletPermissionsError extends WalletValidationError {
  constructor (message) {
    super('wrong permissions: ' + message)
    this.name = 'WalletPermissionsError'
  }
}

export class WalletStaleConfigError extends WalletConfigurationError {
  constructor () {
    super('wallet changed since last test')
    this.name = 'WalletStaleConfigError'
  }
}
