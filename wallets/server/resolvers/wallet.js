import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { mapUserWalletResolveTypes } from '@/wallets/server/resolvers/util'
import { upsertWalletProtocol } from './protocol'

const WalletOrTemplate = {
  __resolveType: walletOrTemplate => walletOrTemplate.__resolveType
}

const UserWallet = {
  name: wallet => wallet.template.name,
  send: wallet => wallet.protocols.some(protocol => protocol.send),
  receive: wallet => wallet.protocols.some(protocol => !protocol.send)
}

const WalletTemplate = {
  send: walletTemplate => walletTemplate.sendProtocols.length > 0,
  receive: walletTemplate => walletTemplate.recvProtocols.length > 0,
  protocols: walletTemplate => {
    return [
      ...walletTemplate.sendProtocols.map(protocol => ({
        id: `WalletTemplate-${walletTemplate.id}-${protocol}-send`,
        name: protocol,
        send: true
      })),
      ...walletTemplate.recvProtocols.map(protocol => ({
        id: `WalletTemplate-${walletTemplate.id}-${protocol}-recv`,
        name: protocol,
        send: false
      }))
    ]
  }
}

export const resolvers = {
  WalletOrTemplate,
  UserWallet,
  WalletTemplate,
  Query: {
    wallets,
    wallet
  },
  Mutation: {
    updateWalletEncryption,
    clearVault,
    setWalletPriority,
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
  let walletTemplates = await models.walletTemplate.findMany()

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

async function updateWalletEncryption (parent, { keyHash, wallets }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()
  if (!keyHash) throw new GqlInputError('hash required')

  const { vaultKeyHash: oldKeyHash } = await models.user.findUnique({ where: { id: me.id } })

  return await models.$transaction(async tx => {
    for (const { id: userWalletId, protocols } of wallets) {
      for (const { name, send, config } of protocols) {
        const mutation = upsertWalletProtocol({ name, send }, { networkTests: false })
        await mutation(parent, { walletId: userWalletId, ...config }, { me, tx })
      }
    }

    // optimistic concurrency control:
    // make sure the user's vault key didn't change while we were updating the protocols
    await tx.user.update({
      where: { id: me.id, vaultKeyHash: oldKeyHash },
      data: { vaultKeyHash: keyHash, showPassphrase: false }
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
