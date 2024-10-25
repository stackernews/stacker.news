/*
   we want to take all the validate members from the provided wallet
   and compose into a single yup schema for formik validation ...
   the validate member can be on of:
   - a yup schema
   - a function that throws on an invalid value
   - a regular expression that must match
*/

import { autowithdrawSchemaMembers } from '@/lib/validate'
import * as Yup from '@/lib/yup'
import { canReceive } from './common'

export default async function validateWallet (walletDef, data, options = { abortEarly: true, topLevel: true }) {
  let schema = composeWalletSchema(walletDef)

  if (canReceive({ def: walletDef, config: data })) {
    schema = schema.concat(autowithdrawSchemaMembers)
  }

  await schema.validate(data, options)

  const casted = schema.cast(data, { assert: false })
  if (options.topLevel && walletDef.validate) {
    await walletDef.validate(casted)
  }

  return casted
}

function createFieldSchema (name, validate) {
  if (!validate) {
    throw new Error(`No validation provided for field ${name}`)
  }

  if (Yup.isSchema(validate)) {
    // If validate is already a Yup schema, return it directly
    return validate
  } else if (typeof validate === 'function') {
    // If validate is a function, create a custom Yup test
    return Yup.mixed().test({
      name,
      test: (value, context) => {
        try {
          validate(value)
          return true
        } catch (error) {
          return context.createError({ message: error.message })
        }
      }
    })
  } else if (validate instanceof RegExp) {
    // If validate is a regular expression, use Yup.matches
    return Yup.string().matches(validate, `${name} is invalid`)
  } else {
    throw new Error(`validate for ${name} must be a yup schema, function, or regular expression`)
  }
}

function composeWalletSchema (walletDef) {
  const { fields } = walletDef

  const schemaShape = fields.reduce((acc, field) => {
    const { name, validate, optional, requiredWithout } = field

    acc[name] = createFieldSchema(name, validate)

    if (!optional) {
      acc[name] = acc[name].required('Required')
    } else if (requiredWithout) {
      acc[name] = acc[name].when([requiredWithout], ([pairSetting], schema) => {
        if (!pairSetting) return schema.required(`required if ${requiredWithout} not set`)
        return Yup.mixed().or([schema.test({
          test: value => value !== pairSetting,
          message: `${name} cannot be the same as ${requiredWithout}`
        }), Yup.mixed().notRequired()])
      })
    }

    return acc
  }, {})

  // we use Object.keys(schemaShape).reverse() to avoid cyclic dependencies in Yup schema
  // see https://github.com/jquense/yup/issues/176#issuecomment-367352042
  const composedSchema = Yup.object().shape(schemaShape, Object.keys(schemaShape).reverse()).concat(Yup.object({
    enabled: Yup.boolean(),
    priority: Yup.number().min(0, 'must be at least 0').max(100, 'must be at most 100')
  }))

  return composedSchema
}
