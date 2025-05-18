/*
   we want to take all the validate members from the provided wallet
   and compose into a single yup schema for formik validation ...
   the validate member can be on of:
   - a yup schema
   - a function that throws on an invalid value
   - a regular expression that must match
*/

// TODO(wallet-v2): will this need an update?
//
// Am I going to validate the wallets differently now?

import { autowithdrawSchemaMembers, vaultEntrySchema } from '@/lib/validate'
import * as Yup from '@/lib/yup'
import { canReceive } from './common'

export default async function validateWallet (walletDef, data,
  { yupOptions = { abortEarly: true }, topLevel = true, serverSide = false, skipGenerated = false } = {}) {
  let schema = composeWalletSchema(walletDef, serverSide, skipGenerated)

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

function composeWalletSchema (walletDef, serverSide, skipGenerated) {
  const { fields } = walletDef

  const vaultEntrySchemas = { required: [], optional: [] }
  const cycleBreaker = []
  const schemaShape = fields.reduce((acc, field) => {
    const { name, validate, optional, generated, clientOnly, requiredWithout } = field

    if (generated && skipGenerated) {
      return acc
    }

    // TODO(wallet-v2): this will probably need an update
    if (clientOnly && serverSide) {
      // For server-side validation, accumulate clientOnly fields as vaultEntries
      vaultEntrySchemas[optional ? 'optional' : 'required'].push(vaultEntrySchema(name))
    } else {
      acc[name] = createFieldSchema(name, validate)

      if (!optional) {
        acc[name] = acc[name].required('required')
      } else if (requiredWithout) {
        const myName = serverSide ? 'vaultEntries' : name
        const partnerName = serverSide ? 'vaultEntries' : requiredWithout
        // if a cycle breaker between this pair hasn't been added yet, add it
        if (!cycleBreaker.some(pair => pair[1] === myName)) {
          cycleBreaker.push([myName, partnerName])
        }
        // if we are the server, the pairSetting will be in the vaultEntries array
        acc[name] = acc[name].when([partnerName], ([pairSetting], schema) => {
          if (!pairSetting || (serverSide && !pairSetting.some(v => v.key === requiredWithout))) {
            return schema.required(`required if ${requiredWithout} not set`)
          }
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
  if (vaultEntrySchemas.required.length > 0 || vaultEntrySchemas.optional.length > 0) {
    schemaShape.vaultEntries = Yup.array().equalto(vaultEntrySchemas)
  }

  // we use cycleBreaker to avoid cyclic dependencies in Yup schema
  // see https://github.com/jquense/yup/issues/176#issuecomment-367352042
  const composedSchema = Yup.object().shape(schemaShape, cycleBreaker).concat(Yup.object({
    enabled: Yup.boolean(),
    priority: Yup.number().min(0, 'must be at least 0').max(100, 'must be at most 100')
  }))

  return composedSchema
}
