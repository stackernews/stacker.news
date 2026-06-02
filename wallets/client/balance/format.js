import { numWithUnits } from '@/lib/format'

export const SAT_UNITS = { unitSingular: 'sat', unitPlural: 'sats' }

// A ready balance carries exactly one of two display shapes:
//   - fiat:  { currency } — amount is in minor units (e.g. cents)
//   - count: { units, compactUnits } — amount is a count; compactUnits is the
//     short label shown in dense rows
// This is the only place defaults get filled, so the formatters below trust
// the shape and just pick a render path.
export function balanceDisplay ({ currency, units, compactUnits } = {}) {
  if (currency && currency !== 'BTC') return { currency }
  const unit = units ?? SAT_UNITS
  return { units: unit, compactUnits: compactUnits ?? unit }
}

function formatFiat (amount, currency) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount / 100)
}

// Dense rows + the send shell's "available" line: abbreviated number with the
// compact label, e.g. "1.2k sats" or "$12.34".
export function formatBalanceText ({ amount, display }) {
  if (display.currency) return formatFiat(amount, display.currency)
  return numWithUnits(amount, { abbreviate: true, format: true, ...display.compactUnits })
}

// The big hero balance: full number and full unit label at different sizes.
export function formatBalanceParts ({ amount, display }) {
  if (display.currency) return { amount: formatFiat(amount, display.currency), unit: display.currency }
  return {
    amount: new Intl.NumberFormat().format(amount),
    unit: amount === 1 ? display.units.unitSingular : display.units.unitPlural
  }
}
