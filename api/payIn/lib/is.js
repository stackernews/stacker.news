import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { payInTypeModules } from '../types'

export async function isPessimistic (payIn, { me }) {
  const payInModule = payInTypeModules[payIn.payInType]
  return !me || !payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC)
}

export async function isPayableWithCredits (payIn) {
  const payInModule = payInTypeModules[payIn.payInType]
  return payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT)
}

export async function isInvoiceable (payIn) {
  const payInModule = payInTypeModules[payIn.payInType]
  return payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC) ||
    payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC) ||
    payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.P2P)
}

export async function isP2P (payIn) {
  const payInModule = payInTypeModules[payIn.payInType]
  return payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.P2P)
}

export async function isWithdrawal (payIn) {
  return payIn.payInType === 'WITHDRAWAL'
}
