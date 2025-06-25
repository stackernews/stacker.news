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

export function walletLud16Domain (name) {
  const url = walletJson(name)?.url
  if (!url) return undefined

  return typeof url === 'string' ? new URL(url).hostname : url.lud16Domain
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

export function reverseProtocolRelationName (relationName) {
  return protocols.find(protocol => protocol.relationName.toLowerCase() === relationName.toLowerCase())
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

export function isWallet (wallet) {
  return !isTemplate(wallet)
}

export function isTemplate (obj) {
  return obj.__typename.endsWith('Template')
}

export function isEncrypted (wallet) {
  return wallet.encrypted
}
