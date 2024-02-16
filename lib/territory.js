import { TERRITORY_GRACE_DAYS, TERRITORY_PERIOD_COST } from './constants'
import { datePivot, diffDays } from './time'

export function nextNextBilling (sub) {
  if (!sub || sub.billingType === 'ONCE') return null

  const pivot = sub.billingType === 'MONTHLY'
    ? { months: 1 }
    : { years: 1 }

  return datePivot(new Date(sub.billPaidUntil), pivot)
}

export function purchasedType (sub) {
  if (!sub?.billPaidUntil) return 'ONCE'
  return diffDays(new Date(sub.billedLastAt), new Date(sub.billPaidUntil)) >= 365 ? 'YEARLY' : 'MONTHLY'
}

export function consumedBilling (sub) {
  if (!sub?.billPaidUntil) return null

  const consumed = diffDays(new Date(sub.billedLastAt), new Date())
  const purchased = diffDays(new Date(sub.billedLastAt), new Date(sub.billPaidUntil))

  return TERRITORY_PERIOD_COST(purchasedType(sub)) -
    Math.floor(TERRITORY_PERIOD_COST(purchasedType(sub)) * consumed / purchased)
}

export function proratedBillingCost (sub, newBillingType) {
  if (!sub ||
    sub.billingType === 'ONCE' ||
    sub.billingType === newBillingType.toUpperCase()) return null

  return TERRITORY_PERIOD_COST(newBillingType) - consumedBilling(sub)
}

export function nextBillingWithGrace (sub) {
  if (!sub) return null
  return datePivot(new Date(sub.billPaidUntil), { days: TERRITORY_GRACE_DAYS })
}
