export const abbrNum = n => {
  if (n < 1e4) return n
  if (n >= 1e4 && n < 1e6) return +(n / 1e3).toFixed(1) + 'k'
  if (n >= 1e6 && n < 1e9) return +(n / 1e6).toFixed(1) + 'm'
  if (n >= 1e9 && n < 1e12) return +(n / 1e9).toFixed(1) + 'b'
  if (n >= 1e12) return +(n / 1e12).toFixed(1) + 't'
}

/**
 * Take a number that represents a count of sats
 * and return a formatted label e.g. 0 sats, 1 sat, 2 sats
 * 
 * @param n The number of sats
 * @param abbreviateNumber Whether to abbreviate the number of sats e.g. 1k sats vs 1000 sats. Defaults to true if omitted.
 */
export const satsLabel = (n, abbreviateNumber = true) =>  {
  if (isNaN(n)) {
    return `${n} sats`
  }
  return `${abbreviateNumber ? abbrNum(n) : n} ${n === 1 ? 'sat' : 'sats'}`
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

export const msatsToSatsDecimal = msats => {
  if (msats === null || msats === undefined) {
    return null
  }
  return fixedDecimal(Number(msats) / 1000.0, 3)
}
