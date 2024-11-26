export const abbrNum = n => {
  if (n < 1e4) return n
  if (n >= 1e4 && n < 1e6) return +(n / 1e3).toFixed(1) + 'k'
  if (n >= 1e6 && n < 1e9) return +(n / 1e6).toFixed(1) + 'm'
  if (n >= 1e9 && n < 1e12) return +(n / 1e9).toFixed(1) + 'b'
  if (n >= 1e12) return +(n / 1e12).toFixed(1) + 't'
}

export function suffix (n) {
  const j = n % 10
  const k = n % 100
  if (j === 1 && k !== 11) {
    return n + 'st'
  }
  if (j === 2 && k !== 12) {
    return n + 'nd'
  }
  if (j === 3 && k !== 13) {
    return n + 'rd'
  }
  return n + 'th'
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
  format,
  satsSuffix
} = {}) => {
  if (isNaN(n)) {
    return `${n} ${unitPlural}`
  }
  let v = `${abbreviate ? abbrNum(n) : !abbreviate || format === true ? new Intl.NumberFormat().format(n) : n}`
  if (satsSuffix)v += '+'
  v += ` ${n === 1 ? unitSingular : unitPlural}`
  return v
}

export const fixedDecimal = (n, f) => {
  return Number.parseFloat(n).toFixed(f)
}

export const msatsToSats = msats => {
  if (msats === null || msats === undefined) {
    return null
  }
  // implicitly floors the result
  return Number(BigInt(msats) / 1000n)
}

export const satsToMsats = sats => {
  if (sats === null || sats === undefined) {
    return null
  }
  return BigInt(sats) * 1000n
}

export const msatsSatsFloor = msats => satsToMsats(msatsToSats(msats))

export const msatsToSatsDecimal = msats => {
  if (msats === null || msats === undefined) {
    return null
  }
  return fixedDecimal(Number(msats) / 1000.0, 3)
}

/**
 * Take a number that represents a count
 * and return a formatted label
 *
 * @param n The number of sats
 * @param opts Options
 * @param opts.abbreviate Whether to abbreviate the number
 * @param opts.withUnit Whether to include the unit in the output
 * @param opts.format Format the number with `Intl.NumberFormat`. Can only be used if `abbreviate` is false
 */
export const formatSats = (sats, { abbreviate = false, withUnit = true, format, satsSuffix } = {}) => {
  if (withUnit) {
    const unitPlural = 'sats'
    const unitSingular = 'sat'
    return numWithUnits(sats, { unitSingular, unitPlural, abbreviate, format, satsSuffix })
  } else {
    return '' + (abbreviate ? abbrNum(sats) : sats) + (satsSuffix || '')
  }
}

/**
 * Take a number that represents a count
 * and return a formatted label
 *
 * @param n The number of sats
 * @param opts Options
 * @param opts.abbreviate Whether to abbreviate the number
 * @param opts.withUnit Whether to include the unit in the output
 * @param opts.format Format the number with `Intl.NumberFormat`. Can only be used if `abbreviate` is false
 */
export const formatMsats = (msats, { abbreviate = false, withUnit = true, format } = {}) => {
  if (withUnit) {
    const unitPlural = 'msats'
    const unitSingular = 'msat'
    return numWithUnits(msats, { unitSingular, unitPlural, abbreviate, format })
  } else {
    return '' + (abbreviate ? abbrNum(msats) : msats)
  }
}

export const hexToB64 = hexstring => {
  return btoa(hexstring.match(/\w{2}/g).map(function (a) {
    return String.fromCharCode(parseInt(a, 16))
  }).join(''))
}

// some base64 encoders get fancy and remove padding
export const ensureB64Padding = str => {
  return str + Array((4 - str.length % 4) % 4 + 1).join('=')
}

export const B64_REGEX = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
export const B64_URL_REGEX = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2}[.=]{2}|[A-Za-z0-9_-]{3}[.=])?$/
export const HEX_REGEX = /^[0-9a-fA-F]+$/

export const ensureB64 = hexOrB64Url => {
  if (HEX_REGEX.test(hexOrB64Url)) {
    hexOrB64Url = hexToB64(hexOrB64Url)
  }

  hexOrB64Url = ensureB64Padding(hexOrB64Url)

  // some folks use url-safe base64
  if (B64_URL_REGEX.test(hexOrB64Url)) {
    // Convert from URL-safe base64 to regular base64
    hexOrB64Url = hexOrB64Url.replace(/-/g, '+').replace(/_/g, '/').replace(/\./g, '=')
    switch (hexOrB64Url.length % 4) {
      case 2: hexOrB64Url += '=='; break
      case 3: hexOrB64Url += '='; break
    }
  }

  if (B64_REGEX.test(hexOrB64Url)) {
    return hexOrB64Url
  }

  throw new Error('not a valid hex or base64 url or base64 encoded string')
}

export function giveOrdinalSuffix (i) {
  const j = i % 10
  const k = i % 100
  if (j === 1 && k !== 11) {
    return i + 'st'
  }
  if (j === 2 && k !== 12) {
    return i + 'nd'
  }
  if (j === 3 && k !== 13) {
    return i + 'rd'
  }
  return i + 'th'
}
