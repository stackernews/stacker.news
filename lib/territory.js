import { TERRITORY_GRACE_DAYS, TERRITORY_PERIOD_COST } from './constants'
import { datePivot, diffDays } from './time'

export function nextBilling (relativeTo, billingType) {
  if (!relativeTo || billingType === 'ONCE') return null

  const pivot = billingType === 'MONTHLY'
    ? { months: 1 }
    : { years: 1 }

  return datePivot(new Date(relativeTo), pivot)
}

export function purchasedType (sub) {
  if (!sub?.billPaidUntil) return 'ONCE'
  return diffDays(new Date(sub.billedLastAt), new Date(sub.billPaidUntil)) >= 364 ? 'YEARLY' : 'MONTHLY'
}

export function proratedBillingCost (sub, newBillingType) {
  if (!sub ||
    sub.billingType === 'ONCE' ||
    sub.billingType === newBillingType.toUpperCase()) return 0

  return TERRITORY_PERIOD_COST(newBillingType) - TERRITORY_PERIOD_COST(purchasedType(sub))
}

export function nextBillingWithGrace (sub) {
  if (!sub) return null
  return datePivot(new Date(sub.billPaidUntil), { days: TERRITORY_GRACE_DAYS })
}
