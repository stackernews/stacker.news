import walletDefs from 'wallets/client'

export const Status = {
  Enabled: 'Enabled',
  Disabled: 'Disabled'
}

export function getWalletByName (name) {
  return walletDefs.find(def => def.name === name)
}

export function getWalletByType (type) {
  return walletDefs.find(def => def.walletType === type)
}

export function getStorageKey (name, userId) {
  let storageKey = `wallet:${name}`

  // WebLN has no credentials we need to scope to users
  // so we can use the same storage key for all users
  if (userId && name !== 'webln') {
    storageKey = `${storageKey}:${userId}`
  }

  return storageKey
}

export function walletPrioritySort (w1, w2) {
  // enabled/configured wallets always come before disabled/unconfigured wallets
  if ((w1.config?.enabled && !w2.config?.enabled) || (isConfigured(w1) && !isConfigured(w2))) {
    return -1
  } else if ((w2.config?.enabled && !w1.config?.enabled) || (isConfigured(w2) && !isConfigured(w1))) {
    return 1
  }

  const delta = w1.config?.priority - w2.config?.priority
  // delta is NaN if either priority is undefined
  if (!Number.isNaN(delta) && delta !== 0) return delta

  // if one wallet has a priority but the other one doesn't, the one with the priority comes first
  if (w1.config?.priority !== undefined && w2.config?.priority === undefined) return -1
  if (w1.config?.priority === undefined && w2.config?.priority !== undefined) return 1

  // both wallets have no priority set, falling back to other methods

  // if both wallets have an id, use that as tie breaker
  // since that's the order in which autowithdrawals are attempted
  if (w1.config?.id && w2.config?.id) return Number(w1.config.id) - Number(w2.config.id)

  // else we will use the card title as tie breaker
  return w1.def.card.title < w2.def.card.title ? -1 : 1
}

export function isServerField (f) {
  return f.serverOnly || !f.clientOnly
}

export function isClientField (f) {
  return f.clientOnly || !f.serverOnly
}

function checkFields ({ fields, config }) {
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

export function isConfigured (wallet) {
  return isSendConfigured(wallet) || isReceiveConfigured(wallet)
}

function isSendConfigured (wallet) {
  const fields = wallet.def.fields.filter(isClientField)
  return checkFields({ fields, config: wallet.config })
}

function isReceiveConfigured (wallet) {
  const fields = wallet.def.fields.filter(isServerField)
  return checkFields({ fields, config: wallet.config })
}

export function canSend (wallet) {
  return !!wallet.def.sendPayment && isSendConfigured(wallet)
}

export function canReceive (wallet) {
  return !wallet.def.clientOnly && isReceiveConfigured(wallet)
}
