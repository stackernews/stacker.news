/*
   we want to take all the validate members from the provided wallet
   and compose into a single yup schema for formik validation ...
   the validate member can be on of:
   - a yup schema
   - a function that throws on an invalid value
   - a regular expression that must match
*/

import { autowithdrawSchemaMembers, vaultEntrySchema } from '@/lib/validate'
import * as Yup from '@/lib/yup'
import { canReceive } from './common'

export default async function validateWallet (walletDef, data,
  { yupOptions = { abortEarly: true }, topLevel = true, serverSide = false } = {}) {
  let schema = composeWalletSchema(walletDef, serverSide)

  if (canReceive({ def: walletDef, config: data })) {
    schema = schema.concat(autowithdrawSchemaMembers)
  }

  await schema.validate(data, yupOptions)

  const casted = schema.cast(data, { assert: false })
  if (topLevel && walletDef.validate) {
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

function composeWalletSchema (walletDef, serverSide) {
  const { fields } = walletDef

  const vaultEntrySchemas = []
  const schemaShape = fields.reduce((acc, field) => {
    const { name, validate, optional, clientOnly, requiredWithout } = field

    if (clientOnly && serverSide) {
      // For server-side validation, accumulate clientOnly fields as vaultEntries
      vaultEntrySchemas.push(vaultEntrySchema(name))
    } else {
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
    }

    return acc
  }, {})

  // Finalize the vaultEntries schema if it exists
  if (vaultEntrySchemas.length > 0) {
    schemaShape.vaultEntries = Yup.array().equalto(vaultEntrySchemas)
  }

  // we use Object.keys(schemaShape).reverse() to avoid cyclic dependencies in Yup schema
  // see https://github.com/jquense/yup/issues/176#issuecomment-367352042
  const composedSchema = Yup.object().shape(schemaShape, Object.keys(schemaShape).reverse()).concat(Yup.object({
    enabled: Yup.boolean(),
    priority: Yup.number().min(0, 'must be at least 0').max(100, 'must be at most 100')
  }))

  return composedSchema
}
