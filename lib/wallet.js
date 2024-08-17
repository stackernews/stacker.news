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
