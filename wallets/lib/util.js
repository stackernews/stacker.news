import * as yup from 'yup'
import wallets from '@/wallets/lib/wallets.json'
import protocols from '@/wallets/lib/protocols'
import { SSR } from '@/lib/constants'

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

export function stripLightningAddressDomain (address, domain) {
  if (!address || !domain) return address
  const suffix = `@${domain}`
  return address.endsWith(suffix) ? address.slice(0, -suffix.length) : address
}

export function appendLightningAddressDomain (address, domain) {
  if (!address || !domain || address.includes('@')) return address
  return `${address}@${domain}`
}

export function walletGuideUrl (name) {
  return walletJson(name)?.guide
}

function protocol ({ name, send }) {
  return protocols.find(protocol => protocol.name === name && protocol.send === send)
}

export function protocolDisplayName ({ name, send }) {
  return protocol({ name, send })?.displayName || titleCase(name)
}

export function protocolLogName ({ name, send }) {
  return protocol({ name, send })?.logName ?? protocolDisplayName({ name, send })
}

export function protocolRelationName ({ name, send }) {
  return protocol({ name, send })?.relationName
}

export function reverseProtocolRelationName (relationName) {
  return protocols.find(protocol => protocol.relationName.toLowerCase() === relationName.toLowerCase())
}

// Encrypted fields are persisted Vault entries and must carry the active vault
// keyHash. Plaintext receive probes can omit keyHash only because their protocol
// fields are not encrypted.
export function protocolServerSchema ({ name, send }, { keyHash } = {}) {
  const fields = protocolFields({ name, send })
  const hasEncryptedFields = fields.some(field => field.encrypt)
  if (hasEncryptedFields && !keyHash) {
    throw new Error('vault keyHash required for encrypted protocol fields')
  }

  const schema = yup.object(fields.reduce((acc, field) => {
    if (field.encrypt) {
      const encryptedSchema = yup.object({
        iv: yup.string().required('required').hex().length(24),
        value: yup.string().required('required').hex(),
        keyHash: yup.string().required('required').equals([keyHash], `must be ${keyHash}`)
      })
      return {
        ...acc,
        [field.name]: encryptedSchema.default(undefined).required('required')
      }
    }

    return {
      ...acc,
      [field.name]: field.required ? field.validate.required('required') : field.validate
    }
  }, {}))
  return schema
}

export function protocolFields ({ name, send }) {
  return protocol({ name, send })?.fields || []
}

export function protocolAvailable ({ name, send }) {
  const { isAvailable } = protocol({ name, send })

  if (!SSR && typeof isAvailable === 'function') {
    return isAvailable()
  }

  return true
}

export function orderedSendProtocols (wallet) {
  const configuredSendProtocols = wallet.protocols.filter(protocol => protocol.send && protocol.enabled)
  const configuredByName = new Map(configuredSendProtocols.map(protocol => [protocol.name, protocol]))
  const templateOrderedProtocols = (wallet.template?.protocols || [])
    .filter(protocol => protocol.send)
    .map(protocol => configuredByName.get(protocol.name))
    .filter(Boolean)
  const remainingProtocols = configuredSendProtocols
    .filter(protocol => !templateOrderedProtocols.some(ordered => ordered.id === protocol.id))
  return [...templateOrderedProtocols, ...remainingProtocols]
}

export function isEncryptedField (protocol, key) {
  const fields = protocolFields(protocol)
  return fields.find(field => field.name === key && field.encrypt)
}

export function templateNameToPathSegment (name) {
  return name.toLowerCase().replace(/_/g, '-')
}

export function templatePathSegmentToName (pathSegment) {
  return pathSegment.toUpperCase().replace(/-/g, '_')
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

export function protocolFormId ({ name, send }) {
  // we don't use the protocol id as the form id because then we can't find the
  // complementary protocol to share fields between templates and non-templates
  // by simply flipping send to recv and vice versa
  return `${name}-${send ? 'send' : 'recv'}`
}
