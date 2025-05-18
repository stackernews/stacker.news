import gql from 'graphql-tag'
import { isServerField } from './common'
import { WALLET_FIELDS } from '@/fragments/wallet'

// TODO(wallet-v2): will we still need this?
//
// The plan is to generate the typedefs during the build process and write them into a file
// with a header that mentions that this file was generated and thus shuold not be edited manually.

export function fieldToGqlArg (field) {
  let arg = `${field.name}: String`
  if (!field.optional) {
    arg += '!'
  }
  return arg
}

// same as fieldToGqlArg, but makes the field always optional
export function fieldToGqlArgOptional (field) {
  return `${field.name}: String`
}

export function generateResolverName (walletField) {
  const capitalized = walletField[0].toUpperCase() + walletField.slice(1)
  return `upsert${capitalized}`
}

export function generateTypeDefName (walletType) {
  const PascalCase = walletType.split('_').map(s => s[0].toUpperCase() + s.slice(1).toLowerCase()).join('')
  return `Wallet${PascalCase}`
}

export function generateMutation (wallet) {
  const resolverName = generateResolverName(wallet.walletField)

  let headerArgs = '$id: ID, '
  headerArgs += wallet.fields
    .filter(isServerField)
    .map(f => `$${f.name}: String`)
    .join(', ')
  headerArgs += ', $enabled: Boolean, $priority: Int, $vaultEntries: [VaultEntryInput!], $settings: AutowithdrawSettings, $validateLightning: Boolean'

  let inputArgs = 'id: $id, '
  inputArgs += wallet.fields
    .filter(isServerField)
    .map(f => `${f.name}: $${f.name}`).join(', ')
  inputArgs += ', enabled: $enabled, priority: $priority, vaultEntries: $vaultEntries, settings: $settings, validateLightning: $validateLightning'

  return gql`
    ${WALLET_FIELDS}
    mutation ${resolverName}(${headerArgs}) {
      ${resolverName}(${inputArgs}) {
      ...WalletFields
    }
  }`
}
