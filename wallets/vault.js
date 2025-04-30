import { getWalletByType } from '@/wallets/common'
import walletDefs from '@/wallets/client'

export const vaultPrismaFragments = {
  create: createFragment,
  upsert: upsertFragment,
  deleteMissing: deleteMissingFragment,
  deleteAll: deleteAllFragment,
  include: includeFragment
}

function createFragment (wallet) {
  return wallet.vaultEntries?.reduce((acc, { key, iv, value }) => ({
    ...acc,
    [key]: {
      create: { iv, value }
    }
  }), {})
}

function upsertFragment (wallet) {
  return wallet.vaultEntries?.reduce((acc, { key, iv, value }) => ({
    ...acc,
    [key]: {
      upsert: {
        create: { iv, value },
        update: { iv, value }
      }
    }
  }), {})
}

function deleteMissingFragment (wallet) {
  const del = deleteAllFragment(wallet)
  for (const { key: name } of wallet.vaultEntries) {
    delete del[name]
  }
  return del
}

function deleteAllFragment (wallet) {
  const def = getWalletByType(wallet.type)
  const names = vaultFieldNames(def)
  return names.reduce((acc, name) => ({
    ...acc,
    [name]: { delete: true }
  }), {})
}

function includeFragment (wallet) {
  const include = walletDefs.reduce((acc, def) => {
    const names = vaultFieldNames(def)
    if (names.length === 0) return acc

    return {
      ...acc,
      [def.walletField]: {
        include: names.reduce((acc2, name) => ({
          ...acc2,
          [name]: true
        }), {})
      }
    }
  }, {})

  if (wallet) {
    const def = getWalletByType(wallet.type)
    const names = vaultFieldNames(def)
    if (names.length === 0) return {}
    return { [def.walletField]: include[def.walletField] }
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
    const newVaultEntry = wallet?.[def.walletField]?.[name]
    if (newVaultEntry) newVaultEntries.push({ ...newVaultEntry, key: name })
  }

  return {
    ...wallet,
    vaultEntries: newVaultEntries
  }
}

export function deleteVault (models, wallet) {
  const def = getWalletByType(wallet.type)
  return models[def.walletField].update({
    where: { walletId: wallet.id },
    data: vaultPrismaFragments.deleteAll(wallet)
  })
}

export function hasVault (wallet) {
  const def = getWalletByType(wallet.type)
  const vaultNames = vaultFieldNames(def)
  return vaultNames.some(name => wallet.wallet?.[`${name}Id`])
}
