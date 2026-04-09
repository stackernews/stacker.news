export function describePayInType (payIn, me) {
  function type () {
    switch (payIn.payInType) {
      case 'ITEM_CREATE':
        if (payIn.item.isJob) {
          return 'job'
        } else if (payIn.item.title) {
          return 'post'
        } else if (payIn.item.parentId) {
          return 'comment'
        } else {
          return 'item'
        }
      case 'ITEM_UPDATE':
        if (payIn.item.isJob) {
          return 'job edit'
        } else if (payIn.item.title) {
          return 'post edit'
        } else if (payIn.item.parentId) {
          return 'comment edit'
        } else {
          return 'item edit'
        }
      case 'ZAP':
        return 'zap'
      case 'BOUNTY_PAYMENT':
        return 'pay bounty'
      default:
        return payTypeShortName(payIn.payInType)
    }
  }

  const t = type()
  if (!payIn.isSend) {
    if (payIn.payInState === 'FAILED') {
      return t + ' refund'
    } else if (['AUTO_WITHDRAWAL', 'WITHDRAWAL'].includes(payIn.payInType)) {
      return t + ' completed'
    }
  }
  if (!payIn.payerPrivates?.userId || !payIn.isSend) {
    return t + ' receive'
  }
  if (payIn.genesisId) {
    return t + ' (retry)'
  }

  return t
}

export function payTypeShortName (type) {
  return type.toLowerCase().replaceAll('_', ' ')
}

export const FAILED_PAY_IN_STATES = ['FAILED', 'CANCELLED', 'FAILED_FORWARD']

export const PAY_IN_RECEIVER_FAILURE_REASONS = [
  'INVOICE_WRAPPING_FAILED_HIGH_PREDICTED_FEE',
  'INVOICE_WRAPPING_FAILED_HIGH_PREDICTED_EXPIRY',
  'INVOICE_WRAPPING_FAILED_UNKNOWN',
  'INVOICE_FORWARDING_CLTV_DELTA_TOO_LOW',
  'INVOICE_FORWARDING_FAILED'
]

const DEFAULT_PAY_OUT_BOLT11_FAILURE_DETAIL = {
  message: 'the payment failed for an unknown reason',
  userMessage: 'The payment failed for an unknown reason'
}

const PAY_OUT_BOLT11_FAILURE_DETAILS = {
  INSUFFICIENT_BALANCE: {
    message: 'we didn\'t have enough sending capacity on our side',
    userMessage: 'We didn\'t have enough sending capacity on our side'
  },
  INVALID_PAYMENT: {
    message: 'your wallet rejected the payment details',
    userMessage: 'Your wallet rejected the payment details'
  },
  PATHFINDING_TIMEOUT: {
    message: 'we ran out of time trying to find a path for the payment',
    userMessage: 'We ran out of time trying to find a path for the payment'
  },
  ROUTE_NOT_FOUND: {
    message: 'we couldn\'t find a way to deliver the payment right now',
    userMessage: 'We couldn\'t find a way to deliver the payment right now'
  },
  UNKNOWN_FAILURE: DEFAULT_PAY_OUT_BOLT11_FAILURE_DETAIL
}

const DEFAULT_PAY_IN_FAILURE_DETAIL = {
  level: 'error',
  logMessage: 'the payment failed',
  userMessage: 'The payment failed'
}

const PAY_IN_FAILURE_DETAILS = {
  USER_CANCELLED: {
    level: 'info',
    logMessage: 'invoice canceled by payer',
    userMessage: 'Canceled by payer'
  },
  SYSTEM_CANCELLED: {
    level: 'warn',
    logMessage: 'payment canceled by system',
    userMessage: 'Canceled by system'
  },
  INVOICE_EXPIRED: {
    level: 'warn',
    logMessage: 'invoice expired before it was paid',
    userMessage: 'The invoice expired before it was paid'
  },
  WITHDRAWAL_FAILED: {
    level: 'error',
    logMessage: 'couldn\'t send the payment to the destination wallet',
    userMessage: 'We couldn\'t send the payment to the destination wallet'
  },
  INVOICE_FORWARDING_FAILED: {
    level: 'error',
    logMessage: 'couldn\'t forward the payment to the destination wallet',
    userMessage: 'We couldn\'t forward the payment to the destination wallet'
  },
  INVOICE_FORWARDING_CLTV_DELTA_TOO_LOW: {
    level: 'error',
    logMessage: 'the destination invoice did not leave enough time for the payment to arrive',
    userMessage: 'The destination invoice did not leave enough time for the payment to arrive'
  },
  INVOICE_WRAPPING_FAILED_HIGH_PREDICTED_FEE: {
    level: 'error',
    logMessage: 'network fees were too high to send this payment',
    userMessage: 'Network fees were too high for this payment'
  },
  INVOICE_WRAPPING_FAILED_HIGH_PREDICTED_EXPIRY: {
    level: 'error',
    logMessage: 'this payment would have taken too long to route',
    userMessage: 'This payment would have taken too long to route'
  },
  INVOICE_WRAPPING_FAILED_UNKNOWN: {
    level: 'error',
    logMessage: 'couldn\'t prepare the payment for the destination wallet',
    userMessage: 'We couldn\'t prepare the payment for the destination wallet'
  },
  INVOICE_CREATION_FAILED: {
    level: 'error',
    logMessage: 'couldn\'t create the invoice',
    userMessage: 'We couldn\'t create the invoice'
  },
  HELD_INVOICE_UNEXPECTED_ERROR: {
    level: 'error',
    logMessage: 'the incoming payment hit an unexpected error',
    userMessage: 'The incoming payment hit an unexpected error'
  },
  HELD_INVOICE_SETTLED_TOO_SLOW: {
    level: 'warn',
    logMessage: 'the incoming payment took too long to settle',
    userMessage: 'The incoming payment took too long to settle'
  },
  EXECUTION_FAILED: {
    level: 'error',
    logMessage: 'the payment failed unexpectedly',
    userMessage: 'The payment failed unexpectedly'
  },
  UNKNOWN_FAILURE: {
    level: 'error',
    logMessage: 'the payment failed for an unknown reason',
    userMessage: 'The payment failed for an unknown reason'
  }
}

export function getPayOutBolt11FailureDetail (status) {
  return PAY_OUT_BOLT11_FAILURE_DETAILS[status] ?? DEFAULT_PAY_OUT_BOLT11_FAILURE_DETAIL
}

export function getPayInFailureDetail (reason) {
  return PAY_IN_FAILURE_DETAILS[reason] ?? DEFAULT_PAY_IN_FAILURE_DETAIL
}
