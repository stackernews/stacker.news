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
  format
} = {}) => {
  if (isNaN(n)) {
    return `${n} ${unitPlural}`
  }
  return `${abbreviate ? abbrNum(n) : !abbreviate || format === true ? new Intl.NumberFormat().format(n) : n} ${n === 1 ? unitSingular : unitPlural}`
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

// BIP-177 base-unit rename
export const formatBitcoin = (amount) => numWithUnits(amount, { unitSingular: 'bitcoin', unitPlural: 'bitcoins', abbreviate: false })

// Deprecated: use formatBitcoin
export const formatSats = formatBitcoin
export const formatMsats = (msats) => numWithUnits(toPositiveNumber(msats), { unitSingular: 'msat', unitPlural: 'msats', abbreviate: false })

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

// check if something is _really_ a number.
// returns true for every number in this range: [-Infinity, ..., 0, ..., Infinity]
export const isNumber = x => typeof x === 'number' && !Number.isNaN(x)

/**
 *
 * @param {any | bigint} x
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export const toNumber = (x, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) => {
  if (typeof x === 'undefined') {
    throw new Error('value is required')
  }
  if (typeof x === 'bigint') {
    if (x < BigInt(min) || x > BigInt(max)) {
      throw new Error(`value ${x} must be between ${min} and ${max}`)
    }
    return Number(x)
  } else {
    const n = Number(x)
    if (isNumber(n)) {
      if (x < min || x > max) {
        throw new Error(`value ${x} must be between ${min} and ${max}`)
      }
      return n
    }
  }
  throw new Error(`value ${x} is not a number`)
}

/**
 * @param {any | bigint} x
 * @returns {number}
 */
export const toPositiveNumber = (x) => toNumber(x, 0)

/**
 * @param {any} x
 * @param {bigint | number} [min]
 * @param {bigint | number} [max]
 * @returns {bigint}
 */
export const toBigInt = (x, min, max) => {
  if (typeof x === 'undefined') throw new Error('value is required')

  const n = BigInt(x)
  if (min !== undefined && n < BigInt(min)) {
    throw new Error(`value ${x} must be at least ${min}`)
  }

  if (max !== undefined && n > BigInt(max)) {
    throw new Error(`value ${x} must be at most ${max}`)
  }

  return n
}

/**
 * @param {number|bigint} x
 * @returns {bigint}
 */
export const toPositiveBigInt = (x) => {
  return toBigInt(x, 0)
}

/**
 * @param {number|bigint} x
 * @returns {number|bigint}
 */
export const toPositive = (x) => {
  if (typeof x === 'bigint') return toPositiveBigInt(x)
  return toPositiveNumber(x)
}

/**
 * Truncates a string intelligently, trying to keep natural breaks
 * @param {string} str - The string to truncate
 * @param {number} maxLength - Maximum length of the result
 * @param {string} [suffix='...'] - String to append when truncated
 * @returns {string} Truncated string
 */
export const truncateString = (str, maxLength, suffix = ' ...') => {
  if (!str || str.length <= maxLength) return str

  const effectiveLength = maxLength - suffix.length

  // Split into paragraphs and accumulate until we exceed the limit
  const paragraphs = str.split(/\n\n+/)
  let result = ''
  for (const paragraph of paragraphs) {
    if ((result + paragraph).length > effectiveLength) {
      // If this is the first paragraph and it's too long,
      // fall back to sentence/word breaking
      if (!result) {
        // Try to break at sentence
        const sentenceBreak = paragraph.slice(0, effectiveLength).match(/[.!?]\s+[A-Z]/g)
        if (sentenceBreak) {
          const lastBreak = paragraph.lastIndexOf(sentenceBreak[sentenceBreak.length - 1], effectiveLength)
          if (lastBreak > effectiveLength / 2) {
            return paragraph.slice(0, lastBreak + 1) + suffix
          }
        }

        // Try to break at word
        const wordBreak = paragraph.lastIndexOf(' ', effectiveLength)
        if (wordBreak > 0) {
          return paragraph.slice(0, wordBreak) + suffix
        }

        // Fall back to character break
        return paragraph.slice(0, effectiveLength) + suffix
      }
      return result.trim() + suffix
    }
    result += (result ? '\n\n' : '') + paragraph
  }

  return result
}