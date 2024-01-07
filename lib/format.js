export const abbrNum = n => {
  if (n < 1e4) return n
  if (n >= 1e4 && n < 1e6) return +(n / 1e3).toFixed(1) + 'k'
  if (n >= 1e6 && n < 1e9) return +(n / 1e6).toFixed(1) + 'm'
  if (n >= 1e9 && n < 1e12) return +(n / 1e9).toFixed(1) + 'b'
  if (n >= 1e12) return +(n / 1e12).toFixed(1) + 't'
}

/**
 * Take a number that represents a count
 * and return a formatted label e.g. 0 sats, 1 sat, 2 sats
 *
 * @param n The number of sats
 * @param opts Options
 * @param opts.abbreviate Whether to abbreviate the number
 * @param opts.unitSingular The singular unit label
 * @param opts.unitPlural The plural unit label
 * @param opts.format Format the number with `Intl.NumberFormat`. Can only be used if `abbreviate` is false
 */
export const numWithUnits = (n, {
  abbreviate = true,
  unitSingular = 'sat',
  unitPlural = 'sats',
  format = false
} = {}) => {
  if (isNaN(n)) {
    return `${n} ${unitPlural}`
  }
  return `${abbreviate ? abbrNum(n) : format ? new Intl.NumberFormat().format(n) : n} ${n === 1 ? unitSingular : unitPlural}`
}

export const fixedDecimal = (n, f) => {
  return Number.parseFloat(n).toFixed(f)
}

export const msatsToSats = msats => {
  if (msats === null || msats === undefined) {
    return null
  }
  return Number(BigInt(msats) / 1000n)
}

export const satsToMsats = sats => {
  if (sats === null || sats === undefined) {
    return null
  }
  return BigInt(sats) * 1000n
}

export const msatsToSatsDecimal = msats => {
  if (msats === null || msats === undefined) {
    return null
  }
  return fixedDecimal(Number(msats) / 1000.0, 3)
}
