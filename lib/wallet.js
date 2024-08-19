export function fieldToGqlArg (field) {
  let arg = `${field.name}: String`
  if (!field.optional) {
    arg += '!'
  }
  return arg
}

export function generateResolverName (walletField) {
  const capitalized = walletField[0].toUpperCase() + walletField.slice(1)
  return `upsert${capitalized}`
}

export function generateTypeDefName (walletField) {
  return walletField[0].toUpperCase() + walletField.slice(1)
}

export function walletTypeToResolveType (walletType) {
  // wallet type is in UPPER_CASE but __resolveType requires PascalCase
  const PascalCase = walletType.split('_').map(s => s[0].toUpperCase() + s.slice(1).toLowerCase()).join('')
  return `Wallet${PascalCase}`
}
