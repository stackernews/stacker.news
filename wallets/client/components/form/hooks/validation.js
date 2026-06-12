import * as yup from 'yup'
import { protocolFields, protocolKey } from '@/wallets/lib/util'

// One field-schema builder feeds both the per-field validators (protocol-fields)
// and the whole-draft test gate (validateCapability): the field's yup
// validator with `required` applied. Values are stored as the backend wants them,
// so there's nothing to transform.
export function fieldSchema (field) {
  if (!field.validate) return undefined
  return field.required ? field.validate.required('required') : field.validate
}

function capabilitySchema (protocol) {
  return yup.object(
    protocolFields(protocol).reduce((acc, field) => {
      const schema = fieldSchema(field)
      return schema ? { ...acc, [field.name]: schema } : acc
    }, {})
  )
}

// Validate one protocol's draft before testing it. Returns errors keyed
// `${protocolKey}.${field}` so they drop straight onto the merged form.
export async function validateCapability (protocol, draft) {
  const key = protocolKey(protocol)
  try {
    await capabilitySchema(protocol).validate(draft, { abortEarly: false })
    return { ok: true, errors: {} }
  } catch (err) {
    const issues = err.inner?.length ? err.inner : [err]
    const errors = {}
    for (const issue of issues) {
      if (issue.path) errors[`${key}.${issue.path}`] = issue.message
    }
    return { ok: false, errors }
  }
}
