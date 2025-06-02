import * as yup from 'yup'
import wallets from '@/wallets/lib/wallets.json'
import protocols from '@/wallets/lib/protocols'

function walletJson (name) {
  return wallets.find(wallet => wallet.name === name)
}

export function walletDisplayName (name) {
  return walletJson(name)?.displayName || titleCase(name)
}

export function walletImage (name) {
  return walletJson(name)?.image
}

function protocol ({ name, send }) {
  return protocols.find(protocol => protocol.name === name && protocol.send === send)
}

export function protocolDisplayName ({ name, send }) {
  return protocol({ name, send })?.displayName || titleCase(name)
}

export function protocolRelationName ({ name, send }) {
  return protocol({ name, send })?.relationName
}

export function protocolClientSchema ({ name, send }) {
  const fields = protocolFields({ name, send })
  const schema = yup.object(fields.reduce((acc, field) =>
    ({
      ...acc,
      [field.name]: field.required ? field.validate.required('required') : field.validate
    }), {}))
  return schema
}

export function protocolServerSchema ({ name, send }) {
  const fields = protocolFields({ name, send })
  const schema = yup.object(fields.reduce((acc, field) => {
    if (field.encrypt) {
      const ivSchema = yup.string().hex().length(24)
      const valueSchema = yup.string().hex()
      return {
        ...acc,
        [field.name]: yup.object({
          iv: field.required ? ivSchema.required('required') : ivSchema,
          value: field.required ? valueSchema.required('required') : valueSchema
        })
      }
    }

    return {
      ...acc,
      [field.name]: field.required ? field.validate.required('required') : field.validate
    }
  }, {}))
  return schema
}

export function protocolMutationName ({ name, send }) {
  const relationName = protocolRelationName({ name, send })
  return `upsert${relationName.charAt(0).toUpperCase() + relationName.slice(1)}`
}

export function protocolFields ({ name, send }) {
  return protocol({ name, send })?.fields || []
}

export function isEncryptedField (protocol, key) {
  const fields = protocolFields(protocol)
  return fields.find(field => field.name === key && field.encrypt)
}

export function urlify (name) {
  return name.toLowerCase().replace(/_/g, '-')
}

export function unurlify (urlName) {
  return urlName.toUpperCase().replace(/-/g, '_')
}

function titleCase (name) {
  return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
}
