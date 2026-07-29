import { walletAmountToMsatsOrUndefined } from '@/wallets/lib/amount'
import { WalletPermissionsError, WalletVerificationUnsupportedError } from '@/wallets/lib/errors'

export const EXTERNAL_TRANSACTION_UNKNOWN_REASONS = {
  TRANSIENT_CHECK_FAILED: 'TRANSIENT_CHECK_FAILED',
  PERMISSION_REQUIRED: 'PERMISSION_REQUIRED',
  VERIFICATION_UNSUPPORTED: 'VERIFICATION_UNSUPPORTED',
  STATUS_UNAVAILABLE: 'STATUS_UNAVAILABLE',
  RETENTION: 'RETENTION'
}

export function verificationUnsupportedResult (detail) {
  return {
    status: 'UNKNOWN',
    errorType: EXTERNAL_TRANSACTION_UNKNOWN_REASONS.VERIFICATION_UNSUPPORTED,
    detail
  }
}

const OBSERVATION_ERROR_TYPES = new Set([
  EXTERNAL_TRANSACTION_UNKNOWN_REASONS.TRANSIENT_CHECK_FAILED,
  EXTERNAL_TRANSACTION_UNKNOWN_REASONS.PERMISSION_REQUIRED,
  EXTERNAL_TRANSACTION_UNKNOWN_REASONS.VERIFICATION_UNSUPPORTED
])

// Normalize provider facts into one flat, serializable observation without
// deciding the row's outcome. The server owns terminal-transition policy.
export function toExternalTransactionObservation (provider = {}, {
  error,
  canCheck = true
} = {}) {
  const status = ['PENDING', 'SETTLED', 'FAILED', 'EXPIRED', 'UNKNOWN'].includes(provider?.status)
    ? provider.status
    : 'UNKNOWN'
  const observation = { status }

  if (typeof provider?.providerRequestId === 'string') {
    observation.providerRequestId = provider.providerRequestId
  }
  if (provider?.preimage != null) observation.preimage = provider.preimage
  const msats = walletAmountToMsatsOrUndefined(provider?.msats)
  if (msats != null) observation.msats = String(msats)
  const actualFeeMsats = walletAmountToMsatsOrUndefined(provider?.actualFeeMsats)
  if (actualFeeMsats != null) observation.actualFeeMsats = String(actualFeeMsats)
  if (status === 'SETTLED' && provider?.settledAt != null) {
    const settledAt = walletSettledAtToDateOrUndefined(provider.settledAt)
    if (settledAt) observation.settledAt = settledAt.toISOString()
  }

  const detail = provider?.detail ?? provider?.error ??
    (typeof error === 'string' ? error : error?.message)
  if (detail) observation.detail = String(detail)

  if (!['SETTLED', 'FAILED', 'EXPIRED'].includes(status)) {
    if (!canCheck) {
      observation.errorType = EXTERNAL_TRANSACTION_UNKNOWN_REASONS.VERIFICATION_UNSUPPORTED
    } else if (OBSERVATION_ERROR_TYPES.has(provider?.errorType)) {
      observation.errorType = provider.errorType
    } else if (error instanceof WalletVerificationUnsupportedError) {
      observation.errorType = EXTERNAL_TRANSACTION_UNKNOWN_REASONS.VERIFICATION_UNSUPPORTED
    } else if (error instanceof WalletPermissionsError) {
      observation.errorType = EXTERNAL_TRANSACTION_UNKNOWN_REASONS.PERMISSION_REQUIRED
    } else if (error) {
      observation.errorType = EXTERNAL_TRANSACTION_UNKNOWN_REASONS.TRANSIENT_CHECK_FAILED
    }
  }

  return observation
}

const UNKNOWN_REASON_MESSAGES = {
  TRANSIENT_CHECK_FAILED: 'SN could not confirm the final status after repeated wallet or provider errors.',
  PERMISSION_REQUIRED: 'SN stopped checking because this wallet is missing permission to verify payment status.',
  VERIFICATION_UNSUPPORTED: 'This wallet protocol does not expose payment status verification for this transaction.',
  STATUS_UNAVAILABLE: 'SN could not confirm the final status before the reconciliation period ended.',
  RETENTION: 'SN stopped checking when your invoice retention period elapsed.'
}

function walletSettledAtToDateOrUndefined (settledAt) {
  // Numeric provider timestamps must declare their unit; Date and ISO strings do not.
  if (settledAt == null || !['object', 'string'].includes(typeof settledAt)) return undefined

  let value = settledAt
  if (typeof settledAt === 'object' && !(settledAt instanceof Date)) {
    const seconds = settledAt.seconds
    value = seconds ?? settledAt.milliseconds
    if (!['number', 'string'].includes(typeof value) ||
        (typeof value === 'string' && value.trim() === '')) return undefined
    value = Number(value) * (seconds != null ? 1000 : 1)
  }

  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.getTime() > 0 ? date : undefined
}

export function externalTransactionDiagnosticMessage ({
  direction,
  status,
  unknownReason,
  hash,
  preimage
}) {
  if (direction === 'SEND' && status === 'SETTLED' && hash && !preimage) {
    return 'Wallet reports this payment settled, but no matching preimage was available.'
  }
  if (status !== 'UNKNOWN') return null
  if (direction === 'RECEIVE' &&
    unknownReason === EXTERNAL_TRANSACTION_UNKNOWN_REASONS.STATUS_UNAVAILABLE) {
    return 'The invoice expired, but SN could not confirm its final status. Check your receiving wallet for the final result.'
  }
  return UNKNOWN_REASON_MESSAGES[unknownReason] ?? UNKNOWN_REASON_MESSAGES.STATUS_UNAVAILABLE
}
