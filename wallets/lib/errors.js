export class WalletError extends Error {}
export class WalletConfigurationError extends WalletError {}
export class WalletValidationError extends WalletError {}

export class WalletPermissionsError extends WalletValidationError {
  constructor (message) {
    super('wrong permissions: ' + message)
    this.name = 'WalletPermissionsError'
  }
}

export class WalletVerificationUnsupportedError extends WalletValidationError {
  constructor (message) {
    super(message)
    this.name = 'WalletVerificationUnsupportedError'
  }
}

const WALLET_ACCESS_DENIED_STATUSES = new Set([401, 403])

export function assertWalletAuthorized (res) {
  if (WALLET_ACCESS_DENIED_STATUSES.has(res.status)) {
    throw Object.assign(new WalletPermissionsError(`${res.status} ${res.statusText}`), { status: res.status })
  }
}
