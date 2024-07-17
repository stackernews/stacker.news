import { array, object, string } from 'yup'
import { autowithdrawSchemaMembers, hexOrBase64Validator, lightningAddressValidator } from '@/lib/validate'
import { TOR_REGEXP } from '@/lib/url'

export function generateResolverName (walletField) {
  const capitalized = walletField[0].toUpperCase() + walletField.slice(1)
  return `upsertWallet${capitalized}`
}

export function generateSchema (wallet) {
  if (wallet.schema) return wallet.schema

  const fieldValidator = (field) => {
    if (!field.validate) {
      // default validation
      let validator = string()
      if (!field.optional) validator = validator.required('required')
      return validator
    }

    // complex validation
    if (field.validate.schema) return field.validate.schema

    const { type: validationType, words, min, max } = field.validate

    let validator

    if (validationType === 'string') validator = string()

    if (validationType === 'url') {
      validator = process.env.NODE_ENV === 'development'
        ? string()
          .or([string().matches(/^(http:\/\/)?localhost:\d+$/), string().url()], 'invalid url')
        : string()
          .url()
          .test(async (url, context) => {
            if (field.validate.torAllowed && TOR_REGEXP.test(url)) {
              // allow HTTP and HTTPS over Tor
              if (!/^https?:\/\//.test(url)) {
                return context.createError({ message: 'http or https required' })
              }
              return true
            }
            try {
              // force HTTPS over clearnet
              await string().https().validate(url)
            } catch (err) {
              return context.createError({ message: err.message })
            }
            return true
          })
    }

    if (words) {
      validator = array()
        .transform(function (value, originalValue) {
          if (this.isType(value) && value !== null) {
            return value
          }
          return originalValue ? originalValue.trim().split(/[\s]+/) : []
        })
        .test(async (values, context) => {
          for (const v of values) {
            try {
              await string().oneOf(words).validate(v)
            } catch {
              return context.createError({ message: `'${v}' is not a valid ${field.label} word` })
            }
          }
          return true
        })
    }

    if (validationType === 'email') validator = lightningAddressValidator

    if (validationType === 'socket') validator = string().socket()

    if (validationType === 'hexOrBase64') validator = hexOrBase64Validator

    if (min !== undefined) validator = validator.min(min)
    if (max !== undefined) validator = validator.max(max)

    if (field.validate.length) validator = validator.length(field.validate.length)

    if (!field.optional) validator = validator.required('required')

    if (field.validate.test) {
      validator = validator.test({
        name: field.name,
        test: field.validate.test,
        message: field.validate.message
      })
    }

    return validator
  }

  return object({
    ...wallet.fields.reduce((acc, field) => {
      return {
        ...acc,
        [field.name]: fieldValidator(field)
      }
    }, {}),
    ...(wallet.walletType ? autowithdrawSchemaMembers : {})
  })
}
