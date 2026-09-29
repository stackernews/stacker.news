import { Bolt11SyntaxValidator, SyntaxValidatorConfigError } from '@/lib/deadbolt11/syntax-validator'
import { Bolt11SyntaxError } from '@/lib/deadbolt11/error'
import { BOLT11_CURRENCY } from '@/lib/constants'

export { Bolt11SyntaxError } from '@/lib/deadbolt11/error'

const validator = new Bolt11SyntaxValidator(BOLT11_CURRENCY)
validator.allowBlip39() // allow bLIP39 invoices
export const assertValidBolt11 = validator.lazy(true) // always fail fast

/**
 * The frontend flavor: the reason `bolt11` is invalid, or null when it's valid.
 * For render and form paths that report invalidity instead of throwing.
 *
 * @param {string} bolt11
 * @returns {string|null}
 */
export function bolt11SyntaxError (bolt11) {
  try {
    assertValidBolt11(bolt11)
    return null
  } catch (err) {
    if (err instanceof Bolt11SyntaxError) {
      return err.message
    }
    throw err
  }
}

/**
 * Helper function where we just want to check validity
 *
 * @param {string} bolt11
 * @returns {boolean}
 */
export function isValidBolt11 (bolt11) {
  return bolt11SyntaxError(bolt11) === null
}

/**
 * backend / worker logger
 *
 * @param {string} context
 * @param {Error} err
 */
export function logInvalidBolt11 (context, err) {
  if (err instanceof SyntaxValidatorConfigError) {
    console.error(err)
    return
  }
  const line = (err instanceof Bolt11SyntaxError)
    ? `${context}: invalid invoice: ${err.message ?? '(reason unspecified)'}`
    : `${context}: invoice validation failed: ${err.name} (${err.message})`
  if (err?.bolt11) {
    console.error(line, { bolt11: err.bolt11 })
  } else {
    console.error(line)
  }
}
