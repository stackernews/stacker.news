import { msatsToSatsDecimal, numWithUnits } from '@/lib/format'

export function formatSankeyValue (value) {
  return new Intl.NumberFormat().format(value)
}

export function formatSankeyAsset (msats, type) {
  const sats = msatsToSatsDecimal(msats)
  if (type === 'CREDITS') {
    return numWithUnits(sats, { unitSingular: 'CC', unitPlural: 'CCs', abbreviate: false, format: true })
  }
  return numWithUnits(sats, { unitSingular: 'sat', unitPlural: 'sats', abbreviate: false, format: true })
}
