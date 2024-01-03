import { TERRITORY_GRACE_DAYS } from './constants'
import { datePivot } from './time'

export function nextBilling (sub) {
  if (!sub || sub.billingType === 'ONCE') return null

  const pivot = sub.billingType === 'MONTHLY'
    ? { months: 1 }
    : { years: 1 }

  return datePivot(new Date(sub.billedLastAt), pivot)
}

export function nextNextBilling (sub) {
  if (!sub || sub.billingType === 'ONCE') return null

  const pivot = sub.billingType === 'MONTHLY'
    ? { months: 2 }
    : { years: 2 }

  return datePivot(new Date(sub.billedLastAt), pivot)
}

export function nextBillingWithGrace (sub) {
  const dueDate = nextBilling(sub)
  if (!sub) return null
  return datePivot(dueDate, { days: TERRITORY_GRACE_DAYS })
}
