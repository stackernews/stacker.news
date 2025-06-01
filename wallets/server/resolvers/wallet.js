import { GqlAuthenticationError, GqlInputError, E_VAULT_KEY_EXISTS } from '@/lib/error'
import { mapUserWalletResolveTypes } from '@/wallets/server/resolvers/util'

export const resolvers = {
  Query: {
    wallets,
    wallet
  },
  Mutation: {
    updateVaultKey,
    clearVault,
    setWalletPriority,
    removeWallet
  }
}

async function wallets (parent, args, { me, models }) {
  if (!me) {
    throw new GqlAuthenticationError()
  }

  let userWallets = await models.userWallet.findMany({
    where: {
      userId: me.id
    },
    include: {
      template: true,
      protocols: true
    }
  })

  // return template for all wallets that user has not attached
  let walletTemplates = await models.walletTemplate.findMany({
    where: {
      id: {
        notIn: userWallets.map(w => w.templateId)
      }
    }
  })

  userWallets = userWallets.map(mapUserWalletResolveTypes)
  walletTemplates = walletTemplates.map(t => {
    return {
      ...t,
      __resolveType: 'WalletTemplate'
    }
  })

  return [...userWallets, ...walletTemplates]
}

async function wallet (parent, { id, name }, { me, models }) {
  if (!me) {
    throw new GqlAuthenticationError()
  }

  if (id) {
    const userWallet = await models.userWallet.findUnique({
      where: { id: Number(id), userId: me.id },
      include: {
        template: true,
        protocols: true
      }
    })
    return mapUserWalletResolveTypes(userWallet)
  }

  const template = await models.walletTemplate.findFirst({ where: { name } })
  return { ...template, __resolveType: 'WalletTemplate' }
}

async function updateVaultKey (parent, { entries, hash }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()
  if (!hash) throw new GqlInputError('hash required')

  const { vaultKeyHash: oldKeyHash } = await models.user.findUnique({ where: { id: me.id } })
  if (oldKeyHash) {
    if (oldKeyHash === hash) {
      return true
    }
    throw new GqlInputError('vault key already set', E_VAULT_KEY_EXISTS)
  }

  return await models.$transaction(async tx => {
    // TODO(wallet-v2): use UserWallet instead of Wallet table
    // const wallets = await tx.wallet.findMany({ where: { userId: me.id } })
    // TODO(wallet-v2): implement this
    // for (const wallet of wallets) {
    // }

    // optimistic concurrency control: make sure the user's vault key didn't change while we were updating the wallets
    await tx.user.update({
      where: { id: me.id, vaultKeyHash: oldKeyHash },
      data: { vaultKeyHash: hash }
    })

    return true
  })
}

async function clearVault (parent, args, { me, models }) {
  if (!me) throw new GqlAuthenticationError()
  const txs = []
  txs.push(models.user.update({
    where: { id: me.id },
    data: { vaultKeyHash: '' }
  }))

  // TODO(wallet-v2): use UserWallet instead of Wallet table
  // const wallets = await models.wallet.findMany({ where: { userId: me.id } })
  // txs.push(...wallets.filter(hasVault).map(wallet => deleteVault(models, wallet)))

  await models.$transaction(txs)
  return true
}

async function setWalletPriority (parent, { id, priority }, { me, models }) {
  if (!me) {
    throw new GqlAuthenticationError()
  }

  // TODO(wallet-v2): use UserWallet instead of Wallet table
  await models.wallet.update({ where: { userId: me.id, id: Number(id) }, data: { priority } })

  return true
}

async function removeWallet (parent, { id }, { me, models }) {
  if (!me) {
    throw new GqlAuthenticationError()
  }

  // TODO(wallet-v2): implement this
}
