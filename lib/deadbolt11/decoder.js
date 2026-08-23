import { bech32 } from 'bech32'
import { Bolt11SyntaxError } from './error.js'

export const AMOUNT_MULTIPLIERS = ['m', 'u', 'n', 'p']
Object.freeze(AMOUNT_MULTIPLIERS)

export class TaggedWords {
  constructor (tag, words) {
    if (typeof (tag) !== 'number' || !Number.isFinite(tag)) {
      throw new TypeError('Tags must be numeric')
    }
    if (!Array.isArray(words) || words.some(w => typeof (w) !== 'number')) {
      throw new TypeError('Words must be an array of numbers')
    }
    const thisWords = words.slice()
    Object.freeze(thisWords)
    Object.defineProperty(this, 'tag', {
      get: () => {
        return tag
      }
    })
    Object.defineProperty(this, 'words', {
      get: () => {
        return thisWords
      }
    })
    Object.defineProperty(this, 'length', {
      get: () => {
        return thisWords.length
      }
    })
    Object.defineProperty(this, 'wordAt', {
      value: idx => {
        if (!Number.isInteger(idx) || idx < 0 || idx >= this.length) {
          return undefined
        }
        return thisWords[idx]
      }
    })
  }

  bytes () {
    if ([5, 6, 24].indexOf(this.tag) !== -1) {
      throw new TypeError('Cannot convert integers to bytestreams')
    }
    if (!Object.prototype.hasOwnProperty.call(this, '_bytes')) {
      const bytes = TaggedWords.wordsToBytes(this.words)
      Object.defineProperty(this, '_bytes', {
        get: () => {
          return bytes
        },
        enumerable: false,
        configurable: false
      })
    }
    return this._bytes.slice()
  }

  toString () {
    return `[TaggedWords tag:${this.tag} len:${this.length} words:[${this.words.join(',')}]]`
  }

  static wordsToBytes (words) {
    if (!Array.isArray(words)) {
      throw new TypeError('Expect an array of 5-bit words')
    }
    const out = bech32.fromWords(words)
    return Uint8Array.from(out)
  }
}

export class DecodedBolt11 {
  constructor (request, prefix, sequence, index) {
    this.request = request
    this.prefix = prefix
    this.sequence = sequence
    this.index = index
    Object.freeze(this.sequence)

    // deep freeze the index arrays before freezing the index
    Object.keys(this.index).forEach(k => Object.freeze(this.index[k]))
    Object.freeze(this.index)
    Object.freeze(this)
  }

  prefixIdentifier () {
    return this.prefix.identifier
  }

  prefixCurrencyCode () {
    return this.prefix.currency
  }

  prefixAmount () {
    return { amount: this.prefix.amount, multiplier: this.prefix.multiplier }
  }

  cardinality (type) {
    return Array.isArray(this.index[type]) ? this.index[type].length : 0
  }

  all (type) {
    return Array.isArray(this.index[type]) ? this.index[type].map(idx => this.sequence[idx]) : []
  }

  none (type, comparator) {
    return !this.all(type).some(comparator)
  }

  toString (tok = '\n') {
    return this.sequence.map(item => item.toString()).join(tok)
  }

  static resolvePrefix (prefix) {
    if (typeof prefix !== 'string') {
      throw new TypeError('Extracted prefix must be a string')
    }

    const resolvedPrefix = {
      identifier: prefix.slice(0, 2),
      currency: prefix.slice(2).match(/^[^0-9]*/)[0],
      amount: null,
      multiplier: null
    }

    let amountStr = prefix.slice(2 + resolvedPrefix.currency.length)
    if (amountStr.length > 0) {
      const lastChar = amountStr[amountStr.length - 1]
      let multiplier = null
      if (AMOUNT_MULTIPLIERS.includes(lastChar)) {
        multiplier = lastChar
        amountStr = amountStr.slice(0, -1)
      }
      resolvedPrefix.amount = amountStr
      resolvedPrefix.multiplier = multiplier
    }

    Object.freeze(resolvedPrefix)
    return resolvedPrefix
  }

  static from (request) {
    if (typeof request !== 'string') {
      throw new Bolt11SyntaxError('bolt11 must be a string')
    }

    // TAKEN FROM LND zenc32 maxInvoiceLength = 7089
    // see: https://github.com/lightningnetwork/lnd/blob/90ea05d5a7f9239ede8eb4e2f36d9a66c39e67d5/zpay32/invoice.go#L87
    const MAX_INVOICE_LENGTH = 7089
    if (request.length > MAX_INVOICE_LENGTH) {
      throw new Bolt11SyntaxError('Maximum bolt11 string size is 7089 characters', { bolt11: request })
    }

    let decoded
    try {
      decoded = bech32.decode(request, MAX_INVOICE_LENGTH)
    } catch (parseError) {
      throw new Bolt11SyntaxError('error parsing invoice', { bolt11: request, cause: parseError })
    }
    const { prefix, words } = decoded

    const resolvedPrefix = DecodedBolt11.resolvePrefix(prefix)

    if (words.length < 111) {
      throw new Bolt11SyntaxError('Invoice data part too short to contain a timestamp and signature', { bolt11: request })
    }

    const sequence = []
    const index = {}
    const addToIndex = (type, loc) => {
      if (!Array.isArray(index[type])) {
        index[type] = [loc]
      } else {
        index[type].push(loc)
      }
    }

    // drop 104 signature words, then 7 timestamp words - all we care is that these
    const w = words.slice(0, -104).slice(7)
    let i = 0
    while (i + 3 <= w.length) {
      const type = w[i]
      const len = (w[i + 1] * 32) + w[i + 2]
      if (w.length < i + 3 + len) {
        throw new Bolt11SyntaxError('Attempted to read past buffer', { bolt11: request })
      }
      const datawords = w.slice(i + 3, i + 3 + len)
      sequence.push(new TaggedWords(type, datawords))
      addToIndex(type, sequence.length - 1)
      i += 3 + len
    }
    if (i < w.length) {
      throw new Bolt11SyntaxError('Detected padded data in bech32 encoded string', { bolt11: request })
    }
    return new DecodedBolt11(request, resolvedPrefix, sequence, index)
  }
}

const TAG = {
  1: 'p',
  16: 's',
  13: 'd',
  19: 'n',
  23: 'h',
  27: 'm',
  6: 'x',
  24: 'c',
  9: 'f',
  3: 'r',
  5: '9',
  20: 'b' // from bLIP39
}

export function getTag (type) {
  return Object.prototype.hasOwnProperty.call(TAG, type) ? TAG[type] : `unknown(${type})`
}
