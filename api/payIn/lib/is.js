import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { payInTypeModules } from '../types'

export const PAY_IN_RECEIVER_FAILURE_REASONS = [
  'INVOICE_WRAPPING_FAILED_HIGH_PREDICTED_FEE',
  'INVOICE_WRAPPING_FAILED_HIGH_PREDICTED_EXPIRY',
  'INVOICE_WRAPPING_FAILED_UNKNOWN',
  'INVOICE_FORWARDING_CLTV_DELTA_TOO_LOW',
  'INVOICE_FORWARDING_FAILED'
]

export function isPessimistic (payIn, { me }) {
  const payInModule = payInTypeModules[payIn.payInType]
  return !me || !payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC)
}

export function isPayableWithCredits (payIn) {
  const payInModule = payInTypeModules[payIn.payInType]
  return payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT)
}

export function isInvoiceable (payIn) {
  const payInModule = payInTypeModules[payIn.payInType]
  return payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC) ||
    payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC) ||
    payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.P2P)
}

export function isP2P (payIn) {
  const payInModule = payInTypeModules[payIn.payInType]
  return payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.P2P)
}

export function isWithdrawal (payIn) {
  return payIn.payInType === 'WITHDRAWAL' || payIn.payInType === 'AUTO_WITHDRAWAL'
}

export function isReceiverFailure (payInFailureReason) {
  return PAY_IN_RECEIVER_FAILURE_REASONS.includes(payInFailureReason)
}
