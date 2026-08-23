import { AMOUNT_MULTIPLIERS, getTag, DecodedBolt11, TaggedWords } from './decoder.js'

const assertNumericType = (className, type) => {
  if (typeof (type) !== 'number' || !Number.isFinite(type)) {
    throw new TypeError(`${className} can only be constructed against a numeric type`)
  }
}

export class Rule {
  constructor (name, lambda, errorMessage) {
    if (typeof name !== 'string' || name.length < 1) {
      throw new TypeError('Rule names need to be a string of at least 1 character')
    }
    if (typeof (lambda) !== 'function') {
      throw new TypeError('Rules need a function to evaluate')
    }
    if (typeof (errorMessage) !== 'string') {
      throw new TypeError('Rules need an actual error message')
    }
    this.name = name
    this.lambda = lambda
    this.errorMessage = errorMessage
    Object.freeze(this)
  }

  evaluate (data) {
    if (!(data instanceof DecodedBolt11)) {
      throw new TypeError('Rules can only be evaluated against a DecodedBolt11')
    }
    try {
      return this.lambda(data) === true ? undefined : this.errorMessage
    } catch (e) {
      if (e instanceof TypeError || e instanceof ReferenceError) {
        throw e
      }
      return `${this.errorMessage} (execution threw: ${e.message})`
    }
  }
}

const PADDING_ERROR_MSGS = ['Excess padding', 'Non-zero padding'] // from bech32 v2.0.0
export class BadPaddingRule extends Rule {
  constructor (name, type, skip = 0) {
    assertNumericType('BadPaddingRule', type)
    if (typeof skip !== 'number' || !Number.isFinite(skip) || skip > 1023 || skip < 0) {
      throw new TypeError('BadPaddingRule can only skip between 0 and 1023 words')
    }
    const tag = getTag(type)
    super(
      name,
      data => data.none(type, tagvalue => {
        if (skip > tagvalue.length) return true
        const words = skip > 0 ? tagvalue.words.slice(skip) : tagvalue.words
        try {
          TaggedWords.wordsToBytes(words) // use bech32.fromWords padding error detection
        } catch (e) {
          if (PADDING_ERROR_MSGS.indexOf(e.message) !== -1) {
            return true
          } else {
            throw e
          }
        }
        return false
      }),
      `Tag ${tag} contains non-zero or excess padding in words`
    )
  }
}

export class UnaryRule extends Rule {
  constructor (name, type) {
    assertNumericType('UnaryRule', type)
    const tag = getTag(type)
    super(
      name,
      data => data.cardinality(type) === 1,
      `Tag ${tag} must exist once.`
    )
  }
}

export class OptionalUnaryRule extends Rule {
  constructor (name, type) {
    assertNumericType('OptionalUnaryRule', type)
    const tag = getTag(type)
    super(
      name,
      data => [0, 1].indexOf(data.cardinality(type)) !== -1,
      `Tag ${tag} may only exist once.`
    )
  }
}

export class MutuallyUnaryRule extends Rule {
  constructor (name, types) {
    if (!Array.isArray(types)) {
      throw new TypeError('MutuallyUnaryRule can only be set against an array of types')
    }
    if (types.some(type => (typeof (type) !== 'number' || !Number.isFinite(type)))) {
      throw new TypeError('MutuallyUnaryRule can only be set against individually numeric tag/type')
    }

    const tags = types.map(type => getTag(type)).join(', ')
    super(
      name,
      data => types.reduce((sum, type) => sum + data.cardinality(type), 0) === 1,
      `Tags ${tags} are mutually exclusive and must exist once.`
    )
  }
}

export class ValidUTF8Rule extends Rule {
  constructor (name, type) {
    assertNumericType('ValidUTF8Rule', type)
    const tag = getTag(type)
    const decoder = new TextDecoder('utf-8', { fatal: true })
    super(
      name,
      data => data.none(type, tagvalue => {
        try {
          const bytes = tagvalue.bytes()
          decoder.decode(bytes)
          return false
        } catch (e) {
          return true
        }
      }),
      `Tag ${tag} must be a valid UTF-8 string`
    )
  }
}

export class NoLeadingZeroWordsRule extends Rule {
  constructor (name, type) {
    assertNumericType('NoLeadingZeroWordsRule', type)
    const tag = getTag(type)
    super(
      name,
      data => data.none(type, tagvalue => tagvalue.length > 0 && tagvalue.wordAt(0) === 0),
      `Tag ${tag} must not contain leading 0 field elements`
    )
  }
}

export class NoEmptyElementsRule extends Rule {
  constructor (name, type) {
    assertNumericType('NoEmptyElementsRule', type)
    const tag = getTag(type)
    super(
      name,
      data => data.none(type, tagvalue => tagvalue.length < 1),
      `Tag ${tag} must not be empty`
    )
  }
}

export class ExactSizeRule extends Rule {
  constructor (name, type, exactSize) {
    assertNumericType('ExactSizeRule', type)
    if (typeof (exactSize) !== 'number' || !Number.isFinite(exactSize) || exactSize > 1023) {
      throw new TypeError('ExactSizeRules can only be set against a numeric exactSize <= 1023')
    }
    const tag = getTag(type)
    super(
      name,
      data => data.none(type, tagvalue => tagvalue.length !== exactSize),
      `Tag ${tag} must have an exact size of ${exactSize}`
    )
  }
}

export class StrictWitnessFallbackAddressRule extends Rule {
  // This is exclusively for tag `f` (9) so the constructor does not ask for a type
  constructor (name, strictKnownWitnessPrograms) {
    if (!Array.isArray(strictKnownWitnessPrograms)) {
      throw new TypeError('StrictWitnessFallbackAddressRules expect an array of witness program versions')
    }

    const type = 9
    const tag = getTag(type)
    super(
      name,
      data => data.none(type, tagvalue => {
        if (tagvalue.length < 1) return true
        return strictKnownWitnessPrograms.indexOf(tagvalue.wordAt(0)) === -1
      }),
      `Tag ${tag} must be one of witness programs ${strictKnownWitnessPrograms.join(', ')}`
    )
  }
}

export class FallbackAddressSizeRule extends Rule {
  // This is exclusively for tag `f` (9) so the constructor does not ask for a type
  constructor (name) {
    // allowed program sizes per version, or null where a reader MUST skip the field
    const programSize = version => {
      if (version === 0) return bytes => bytes === 20 || bytes === 32 // P2WPKH or P2WSH
      if (version === 1) return bytes => bytes === 32 // taproot
      if (version === 17 || version === 18) return bytes => bytes === 20 // pubkey hash or script hash
      return null // everything else isn't accepted and will be caught by StrictWitnessFallbackAddressRule
    }

    const type = 9
    const tag = getTag(type)
    super(
      name,
      data => data.none(type, tagvalue => {
        if (tagvalue.length < 1) return true // no version field element at all
        const allowed = programSize(tagvalue.wordAt(0))
        if (allowed === null) return false
        const words = tagvalue.length - 1
        const bytes = Math.floor((words * 5) / 8)
        return !allowed(bytes) || Math.ceil((bytes * 8) / 5) !== words // minimum data_length possible
      }),
      `Tag ${tag} must hold a known version followed by a correctly sized program`
    )
  }
}

export class RoutingHintSizeRule extends Rule {
  constructor (name) {
    // element sizes in bytes:
    // - pubkey 33
    // - short_channel_id 8
    // - fee_base_msat 4
    // - fee_proportional_millionths 4
    // - cltv_expiry_delta 2
    const HOP_BYTES = 33 + 8 + 4 + 4 + 2 // 51 bytes
    const type = 3
    const tag = getTag(type)
    super(
      name,
      data => data.none(type, tagvalue => {
        const bytes = Math.floor((tagvalue.length * 5) / 8)
        if (bytes < HOP_BYTES || bytes % HOP_BYTES !== 0) return true // one or more whole entries
        return Math.ceil((bytes * 8) / 5) !== tagvalue.length // minimum data_length possible
      }),
      `Tag ${tag} must hold one or more whole ${HOP_BYTES}-byte routing hops`
    )
  }
}

export class HrpPrefixRule extends Rule {
  constructor (name) {
    super(
      name,
      data => data.prefixIdentifier() === 'ln',
      'HRP must start with "ln"'
    )
  }
}

export class HrpCurrencyRule extends Rule {
  constructor (name, currency) {
    if (typeof currency !== 'string' || currency.length < 1) {
      throw new TypeError('HrpCurrencyRule can only be set against a single currency code')
    }
    super(
      name,
      data => data.prefixCurrencyCode() === currency,
      `HRP must contain the currency code (${currency})`
    )
  }
}

export class HrpAmountRule extends Rule {
  constructor (name) {
    super(
      name,
      data => {
        const { amount, multiplier } = data.prefixAmount()
        if (amount === null && multiplier === null) return true // empty amount is ok
        return /^[1-9][0-9]*$/.test(amount) // must not have leading zeros or non-decimal characters
      },
      'HRP amount must be a positive decimal integer with no leading zeroes'
    )
  }
}

export class HrpMultiplierRule extends Rule {
  constructor (name) {
    super(
      name,
      data => {
        const { multiplier } = data.prefixAmount()
        if (multiplier === null) {
          return true // no multiplier specified
        }
        return AMOUNT_MULTIPLIERS.indexOf(multiplier) !== -1
      },
      `HRP multiplier must be one of: ${AMOUNT_MULTIPLIERS.join(', ')}`
    )
  }
}

export class HrpPicoDivisibilityRule extends Rule {
  constructor (name) {
    super(
      name,
      data => {
        const { amount, multiplier } = data.prefixAmount()
        if (multiplier === 'p') {
          return /0$/.test(amount)
        } else {
          return true
        }
      },
      'HRP amount with "p" multiplier must be a multiple of 10'
    )
  }
}
