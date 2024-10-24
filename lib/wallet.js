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

export function isServerField (f) {
  return f.serverOnly || !f.clientOnly
}

export function isClientField (f) {
  return f.clientOnly || !f.serverOnly
}

/**
 * Check if a wallet is configured based on its fields and config
 * @param {*} param0
 * @param {*} param0.fields - the fields of the wallet
 * @param {*} param0.config - the configuration of the wallet
 * @param {*} param0.serverOnly - if true, only check server fields
 * @param {*} param0.clientOnly - if true, only check client fields
 * @returns
 */
export function isConfigured ({ fields, config, serverOnly = false, clientOnly = false }) {
  if (!config || !fields) return false

  fields = fields.filter(f => {
    if (clientOnly) return isClientField(f)
    if (serverOnly) return isServerField(f)
    return true
  })

  // a wallet is configured if all of its required fields are set
  let val = fields.every(f => {
    return f.optional ? true : !!config?.[f.name]
  })

  // however, a wallet is not configured if all fields are optional and none are set
  // since that usually means that one of them is required
  if (val && fields.length > 0) {
    val = !(fields.every(f => f.optional) && fields.every(f => !config?.[f.name]))
  }

  return val
}
