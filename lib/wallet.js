export function generateResolverName (walletField) {
  const capitalized = walletField[0].toUpperCase() + walletField.slice(1)
  return `upsertWallet${capitalized}`
}
