import * as rules from './rules.js'
import { DecodedBolt11 } from './decoder.js'
import { Bolt11SyntaxError } from './error.js'

// all syntactic writer rules
const WRITER_RULES = [
  new rules.UnaryRule('exactly-one-p-field', 1), // MUST include exactly one p field.
  new rules.UnaryRule('exactly-one-s-field', 16), // MUST include exactly one s field.
  new rules.MutuallyUnaryRule('exactly-one-d-or-h', [13, 23]), // MUST include either exactly one d or exactly one h field
  new rules.OptionalUnaryRule('optional-one-x-field', 6), // MAY include one x field
  new rules.NoLeadingZeroWordsRule('no-zero-padding-x', 6), // x MUST use the minimum data_length possible, i.e. no leading 0 field-elements.
  new rules.OptionalUnaryRule('optional-one-c-field', 24), // SHOULD include one c field
  new rules.NoLeadingZeroWordsRule('no-zero-padding-c', 24), // c MUST use the minimum data_length possible, i.e. no leading 0 field-elements.
  new rules.OptionalUnaryRule('optional-one-n-field', 19), // MAY include one n field.
  new rules.RoutingHintSizeRule('valid-r-routing-size'), // r field (if present) MUST contain one or more ordered entries;

  // MUST omit the 9 field altogether if there are only zero bits
  // if 9 contains non-zero bits: MUST use the minimum data_length possible to encode the non-zero bits with no 0 field-elements at the start.
  new rules.OptionalUnaryRule('optional-one-9-field', 5),
  new rules.NoLeadingZeroWordsRule('no-zero-padding-9', 5),
  new rules.NoEmptyElementsRule('no-empty-9-element', 5),
  // ----

  // RULES BELOW ARE EXPENSIVE BECAUSE THEY CONVERT 5b TO 8b SO WE DO THEM LAST

  // MUST pad field data to a multiple of 5 bits, using 0s.
  // NOTE: this only applies to encoded bitstreams, not 5-bit BE uint encoding
  // The 3 fields that are excluded are: 9, x, c - those have the NoLeadingZeroWordsRule
  // rule implementation for this same purpose
  new rules.BadPaddingRule('bad-padding-p', 1),
  new rules.BadPaddingRule('bad-padding-s', 16),
  new rules.BadPaddingRule('bad-padding-d', 13),
  new rules.BadPaddingRule('bad-padding-m', 27),
  new rules.BadPaddingRule('bad-padding-n', 19),
  new rules.BadPaddingRule('bad-padding-h', 23),
  new rules.BadPaddingRule('bad-padding-f', 9, 1), // skip the first word as it is a uint5
  new rules.BadPaddingRule('bad-padding-r', 3),
  // ----

  new rules.ValidUTF8Rule('valid-utf8-d', 13), // MUST set d to a valid UTF-8 string.

  // MUST set an f field to a valid witness version and program, OR to 17 followed by
  // a public key hash, OR to 18 followed by a script hash.
  // NOTE: ONLY 0 and 1 are valid witness versions at this time.
  new rules.StrictWitnessFallbackAddressRule('strict-known-f-witness-program', [0, 1, 17, 18]),
  new rules.FallbackAddressSizeRule('fallback-address-size-rule')
  // ----
]

// remaining syntactic reader rules that do not duplicate writer rules
const READER_RULES = [
  // MUST fail the payment if any field with fixed data_length (p, h, s, n) does not have the correct length (52, 52, 52, 53)
  new rules.ExactSizeRule('fixed-length-p', 1, 52),
  new rules.ExactSizeRule('fixed-length-s', 16, 52),
  new rules.ExactSizeRule('fixed-length-h', 23, 52),
  new rules.ExactSizeRule('fixed-length-n', 19, 53),
  new rules.OptionalUnaryRule('optional-one-m-field', 27) // if an m field is provided: MUST use that as payment_metadata
]

const EXPERIMENTAL_BLIP39_RULES = {
  exclude: ['exactly-one-s-field'], // this is replaced by a custom "exactly-one-s-or-multiple-b-fields"
  add: [
    // bLIP39: MUST not contain the s field type
    new rules.Rule(
      'b-fields-exclude-s-fields',
      data => data.cardinality(20) === 0 || data.cardinality(16) === 0,
      'When a tag b field is present, no tag s field may be present'
    ),
    new rules.Rule(
      'must-have-s-if-no-b',
      data => data.cardinality(16) + data.cardinality(20) > 0,
      'If there is no tag b field, must have a tag s field'
    ),
    new rules.OptionalUnaryRule('no-more-than-one-s-field', 16),
    // ----

    new rules.Rule(
      'b-fields-exclude-r-fields',
      data => data.cardinality(20) === 0 || data.cardinality(3) === 0,
      'When a tag b field is present, no tag r field may be present'
    ), // bLIP39: MUST not contain the r field type
    new rules.BadPaddingRule('bad-padding-b', 20), // b is a bytestream
    new rules.NoEmptyElementsRule('no-empty-b-element', 20) // bLIP39: One or more entries each containing a blinded payment path
  ]
}

export class SyntaxValidatorConfigError extends Error { }

export class Bolt11SyntaxValidator {
  constructor (currency) {
    if (typeof currency !== 'string' || currency.length < 1) {
      throw new TypeError('Currency must be a string of at least 1 character')
    }

    // HRP Rules are created on the fly due to variable currency
    const hrpRules = [
      new rules.HrpPrefixRule('hrp-ln-prefix'),
      new rules.HrpCurrencyRule('hrp-currency-known', currency),
      new rules.HrpAmountRule('hrp-amount-decimal-nopadding'),
      new rules.HrpMultiplierRule('hrp-amount-multiplier'),
      new rules.HrpPicoDivisibilityRule('hrp-amount-pico-divisibility')
    ]

    this.rules = [...hrpRules, ...WRITER_RULES, ...READER_RULES]
    this.activatedExtensions = []
  }

  ruleNames () {
    return this.rules.map(r => r.name)
  }

  allowBlip39 () {
    if (this.activatedExtensions.indexOf('blip39') !== -1) {
      throw new SyntaxValidatorConfigError('Blip39 extensions are already activated')
    }
    this.excludeRules(EXPERIMENTAL_BLIP39_RULES.exclude)
    EXPERIMENTAL_BLIP39_RULES.add.forEach(newRule => {
      this.addRule(newRule)
    })
    this.activatedExtensions.push('blip39')
    return this
  }

  excludeRules (rulesToExclude) {
    if (!Array.isArray(rulesToExclude)) {
      throw new SyntaxValidatorConfigError('excludeRules expects an array of rule names to exclude')
    }
    rulesToExclude.forEach(exclName => {
      if (this.ruleNames().indexOf(exclName) === -1) {
        throw new SyntaxValidatorConfigError(`Rule ${exclName} marked for exclusion does not exist`)
      }
    })
    this.rules = this.rules.filter(r => rulesToExclude.indexOf(r.name) === -1)
    return this
  }

  addRule (rule) {
    if (!(rule instanceof rules.Rule)) {
      throw new TypeError('Custom rules must be of Rules class')
    }
    if (this.ruleNames().indexOf(rule.name) !== -1) {
      throw new SyntaxValidatorConfigError(`Rule with name "${rule.name}" already exists`)
    }
    this.rules.push(rule)
    return this
  }

  build (failFast = true) {
    const fixedRules = this.rules.slice()
    const evaluator = failFast
      ? (decodedRequest, ruleSet) => {
          ruleSet.forEach(r => {
            const result = r.evaluate(decodedRequest)
            if (result !== undefined) {
              throw new Bolt11SyntaxError(result, { bolt11: decodedRequest.request })
            }
          })
        }
      : (decodedRequest, ruleSet) => {
          const results = ruleSet.map(r => {
            const err = r.evaluate(decodedRequest)
            return err === undefined ? undefined : `${r.name}: ${err}`
          }).filter(r => r !== undefined)
          if (results.length > 0) {
            throw new Bolt11SyntaxError(`Multiple validation errors occurred: ${results.join(', ')}`, { bolt11: decodedRequest.request })
          }
        }

    return (request) => {
      const decoded = DecodedBolt11.from(request)
      evaluator(decoded, fixedRules)
    }
  }

  lazy (failFast) {
    let validator
    return request => {
      if (typeof (validator) !== 'function') {
        validator = this.build(failFast)
      }
      return validator(request)
    }
  }
}
