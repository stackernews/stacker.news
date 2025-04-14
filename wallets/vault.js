import { getWalletByType } from '@/wallets/common'
import walletDefs from '@/wallets/client'
import { get } from '@/lib/object'

// returns fragments for the Prisma Client API
// input is a wallet row from the db with the new schema
export function vaultPrismaFragments (wallet) {
  let initial = {
    // fragment to use with models.wallet.update or models.wallet.create
    // to include vault rows in the result via new schema
    include: vaultPrismaFragmentInclude(wallet)
  }

  if (!wallet) {
    return initial
  }

  const def = getWalletByType(wallet.type)
  // template for delete fragments
  const del = vaultFieldNames(def).reduce((acc, name) => ({
    ...acc,
    [name]: { delete: true }
  }), {})

  initial = {
    ...initial,
    create: {},
    upsert: {},
    deleteMissing: del,
    // XXX we need to create a copy so we don't also mutate this object inside reduce via the delete keyword
    deleteAll: { ...del }
  }

  if (!wallet.vaultEntries) {
    return initial
  }

  return wallet.vaultEntries.reduce((acc, { key, iv, value }) => {
    delete acc.deleteMissing[key]
    return {
      // fragment to use within [walletField].create or [walletField].upsert.create
      // to create vault rows for a new wallet
      create: {
        ...acc.create,
        [key]: {
          create: { iv, value }
        }
      },
      // fragment to use within [walletField].update or [walletField].upsert.update
      // to upsert vault of wallet
      upsert: {
        ...acc.upsert,
        [key]: {
          upsert: {
            create: { iv, value },
            update: { iv, value }
          }
        }
      },
      // fragments to use within [walletField].update to delete the missing vault rows
      // that would not be updated via the upsert fragment
      deleteMissing: acc.deleteMissing,
      // fragment to use when we want to delete the full vault of a wallet
      deleteAll: acc.deleteAll,
      // pass-through fragment since it was already created before calling reduce
      include: acc.include
    }
  }, initial)
}

function vaultPrismaFragmentInclude (wallet) {
  const include = {}

  for (const def of walletDefs) {
    const names = vaultFieldNames(def)
    if (names.length === 0) continue

    include[def.walletField] = {
      include: names.reduce((acc, name) => ({
        ...acc,
        [name]: true
      }), {})
    }

    if (wallet && wallet.type === def.walletType) {
      return {
        [def.walletField]: include[def.walletField]
      }
    }
  }

  return include
}

function vaultFieldNames (walletDef) {
  return walletDef.fields.filter(f => f.clientOnly).map(f => f.name)
}

export function vaultNewSchematoTypedef (wallet) {
  // this function converts a wallet row from the db with the new schema
  // to the expected GraphQL typedef since the client has not yet been updated.
  //
  // For example, the query for the LNbits wallet now returns the wallet as (url,invoiceKey,adminKey)
  // but the client expects wallet and vaultEntries separated, see api/typedefs/wallet.js.
  //
  // === TODO: remove this function after client update ===
  const def = getWalletByType(wallet.type)

  const newVaultEntries = []
  for (const name of vaultFieldNames(def)) {
    const newVaultEntry = get(wallet, `${def.walletField}.${name}`)
    if (newVaultEntry) newVaultEntries.push({ ...newVaultEntry, key: name })
  }

  return {
    ...wallet,
    vaultEntries: newVaultEntries
  }
}

export function deleteVault (models, wallet) {
  const vaultFrags = vaultPrismaFragments(wallet)
  const def = getWalletByType(wallet.type)
  return models[def.walletField].update({
    where: { walletId: wallet.id },
    data: vaultFrags.deleteAll
  })
}

export function hasVault (wallet) {
  const def = getWalletByType(wallet.type)
  const vaultNames = vaultFieldNames(def)
  return vaultNames.some(name => get(wallet, `wallet.${name}Id`))
}
