import walletDefs from 'wallets/client'

export const Status = {
  Initialized: 'Initialized',
  Enabled: 'Enabled',
  Locked: 'Locked',
  Error: 'Error'
}

export function getWalletByName (name) {
  return walletDefs.find(def => def.name === name)
}

export function getWalletByType (type) {
  return walletDefs.find(def => def.walletType === type)
}

export function getStorageKey (name, me) {
  let storageKey = `wallet:${name}`

  // WebLN has no credentials we need to scope to users
  // so we can use the same storage key for all users
  if (me && name !== 'webln') {
    storageKey = `${storageKey}:${me.id}`
  }

  return storageKey
}

export function walletPrioritySort (w1, w2) {
  const delta = w1.priority - w2.priority
  // delta is NaN if either priority is undefined
  if (!Number.isNaN(delta) && delta !== 0) return delta

  // if one wallet has a priority but the other one doesn't, the one with the priority comes first
  if (w1.priority !== undefined && w2.priority === undefined) return -1
  if (w1.priority === undefined && w2.priority !== undefined) return 1

  // both wallets have no priority set, falling back to other methods

  // if both wallets have an id, use that as tie breaker
  // since that's the order in which autowithdrawals are attempted
  if (w1.config?.id && w2.config?.id) return Number(w1.config.id) - Number(w2.config.id)

  // else we will use the card title as tie breaker
  return w1.card.title < w2.card.title ? -1 : 1
}
