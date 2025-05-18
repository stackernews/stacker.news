import walletDefs from '@/wallets/client'

// TODO(wallet-v2): a lot of this is either unnecessary or can probably be simpler now

// TODO(wallet-v2): if we don't use wallet defs anymore, this probably won't be needed anymore
export function getWalletByName (name) {
  return walletDefs.find(def => def.name === name)
}

// TODO(wallet-v2): if we don't use wallet defs anymore, this probably won't be needed anymore
export function getWalletByType (type) {
  return walletDefs.find(def => def.walletType === type)
}

// TODO(wallet-v2): I think we will still need this, but maybe we flag wallets like WebLN as "device only"
// which means they are not scoped to users but to devices and thus also don't participate in device sync.
// or maybe they do, but then they need checks if the device supports this wallet.
// In the case of WebLN, this means window.webln is available.
export function getStorageKey (name, userId) {
  let storageKey = `wallet:${name}`

  // WebLN has no credentials we need to scope to users
  // so we can use the same storage key for all users
  if (userId && name !== 'webln') {
    storageKey = `${storageKey}:${userId}`
  }

  return storageKey
}

export function walletTag (walletDef) {
  return walletDef.shortName || walletDef.name
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

// TODO(wallet-v2): this can probably be simpliifed now
function checkFields ({ fields, config }) {
  // a wallet is configured if all of its required fields are set
  let val = fields.every(f => {
    if ((f.optional || f.generated) && !f.requiredWithout) return true
    return !!config?.[f.name]
  })

  // however, a wallet is not configured if all fields are optional and none are set
  // since that usually means that one of them is required
  if (val && fields.length > 0) {
    val = !(fields.every(f => f.optional || f.generated) && fields.every(f => !config?.[f.name]))
  }

  return val
}

// TODO(wallet-v2): this can probably be simpliifed now
export function isConfigured ({ def, config }) {
  return isSendConfigured({ def, config }) || isReceiveConfigured({ def, config })
}

// TODO(wallet-v2): this can probably be simpliifed now
function isSendConfigured ({ def, config }) {
  const fields = def.fields.filter(isClientField)
  return (fields.length > 0 || def.isAvailable?.()) && checkFields({ fields, config })
}

function isReceiveConfigured ({ def, config }) {
  const fields = def.fields.filter(isServerField)
  return fields.length > 0 && checkFields({ fields, config })
}

export function supportsSend ({ def, config }) {
  return !!def.sendPayment
}

export function supportsReceive ({ def, config }) {
  return def.fields.some(f => f.serverOnly)
}

export function canSend ({ def, config }) {
  return (
    supportsSend({ def, config }) &&
    isSendConfigured({ def, config }) &&
    (def.requiresConfig || config?.enabled)
  )
}

export function canReceive ({ def, config }) {
  return supportsReceive({ def, config }) && isReceiveConfigured({ def, config })
}

export function siftConfig (fields, config) {
  const sifted = {
    clientOnly: {},
    serverOnly: {},
    shared: {},
    serverWithShared: {},
    clientWithShared: {},
    settings: null
  }

  for (const [key, value] of Object.entries(config)) {
    if (['id'].includes(key)) {
      sifted.serverOnly[key] = value
      continue
    }

    if (['autoWithdrawMaxFeePercent', 'autoWithdrawThreshold', 'autoWithdrawMaxFeeTotal'].includes(key)) {
      sifted.serverOnly[key] = Number(value)
      sifted.settings = { ...sifted.settings, [key]: Number(value) }
      continue
    }

    const field = fields.find(({ name }) => name === key)

    if (field) {
      if (field.serverOnly) {
        sifted.serverOnly[key] = value
      } else if (field.clientOnly) {
        sifted.clientOnly[key] = value
      } else {
        sifted.shared[key] = value
      }
    } else if (['enabled', 'priority'].includes(key)) {
      sifted.shared[key] = value
    }
  }

  sifted.serverWithShared = { ...sifted.shared, ...sifted.serverOnly }
  sifted.clientWithShared = { ...sifted.shared, ...sifted.clientOnly }

  return sifted
}

export async function upsertWalletVariables ({ def, config }, encrypt, append = {}) {
  const { serverWithShared, settings, clientOnly } = siftConfig(def.fields, config)
  // if we are disconnected from the vault, we leave vaultEntries undefined so we don't
  // delete entries from connected devices
  let vaultEntries
  if (clientOnly && encrypt) {
    vaultEntries = []
    for (const [key, value] of Object.entries(clientOnly)) {
      if (value) {
        vaultEntries.push({ key, ...await encrypt(value) })
      }
    }
  }

  return { ...serverWithShared, settings, vaultEntries, ...append }
}

export async function saveWalletLocally (name, config, userId) {
  const storageKey = getStorageKey(name, userId)
  window.localStorage.setItem(storageKey, JSON.stringify(config))
}
