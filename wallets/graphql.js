import gql from 'graphql-tag'
import { isServerField } from './config'

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
    .map(f => {
      const arg = `$${f.name}: String`
      // required fields are checked server-side
      // if (!f.optional) {
      //   arg += '!'
      // }
      return arg
    }).join(', ')
  headerArgs += ', $settings: AutowithdrawSettings!, $priorityOnly: Boolean, $canSend: Boolean!, $canReceive: Boolean!'

  let inputArgs = 'id: $id, '
  inputArgs += wallet.fields
    .filter(isServerField)
    .map(f => `${f.name}: $${f.name}`).join(', ')
  inputArgs += ', settings: $settings, priorityOnly: $priorityOnly, canSend: $canSend, canReceive: $canReceive,'

  return gql`mutation ${resolverName}(${headerArgs}) {
    ${resolverName}(${inputArgs}) {
      id,
      type,
      enabled,
      priority,
      canReceive,
      canSend
    }
  }`
}
