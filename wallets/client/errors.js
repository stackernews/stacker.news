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
// is classified as UNKNOWN by classifyWalletPaymentError.
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

// payError helpers: a user-canceled QR (closing the invoice modal) is an intentional abort, not a
// failure to surface, so callers suppress it.
export const isUserCancelError = (e) => e instanceof InvoiceCanceledError

// a gateway/timeout response (502/503/504 — e.g. the zap recipient's wallet was slow to invoice, so
// the request blew past the load balancer's timeout) didn't return a normal GraphQL result. the
// action's outcome is unknown, but optimistic acts are still processed server-side (the zap falls
// back to credits or persists and auto-retries), so callers shouldn't surface it as a failure.
export const isTransientNetworkError = (e) => e?.statusCode >= 502 && e?.statusCode <= 504

// toast a payIn error unless it's absent, a user cancel, or a transient gateway timeout (used by
// the act/bounty onPayError phases)
export const toastPayError = (toaster, e) => {
  if (e && !isUserCancelError(e) && !isTransientNetworkError(e)) toaster.danger(e?.message || e?.toString?.())
}

// rethrow a pessimistic flow's payError unless it's absent or a user cancel
export const throwUnlessUserCancel = (payError) => {
  if (payError && !isUserCancelError(payError)) throw payError
}

const WALLET_ACCESS_DENIED_STATUSES = new Set([401, 403])

// like assertResponseOk, but first turns an auth rejection (401/403) into the wallet domain's
// WalletPermissionsError so wallet adapters surface "fix your credentials" by error TYPE and the
// receive reconciler never sniffs transport status. `.status` is preserved for callers that read it.
export function assertWalletAuthorized (res) {
  if (WALLET_ACCESS_DENIED_STATUSES.has(res.status)) {
    throw Object.assign(new WalletPermissionsError(`${res.status} ${res.statusText}`), { status: res.status })
  }
}
