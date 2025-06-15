import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { mapWalletResolveTypes } from '@/wallets/server/resolvers/util'
import { removeWalletProtocol, upsertWalletProtocol } from './protocol'
import { validateSchema, walletSettingsSchema } from '@/lib/validate'

const WalletOrTemplate = {
  __resolveType: walletOrTemplate => walletOrTemplate.__resolveType
}

const Wallet = {
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
  Wallet,
  WalletTemplate,
  Query: {
    wallets,
    wallet,
    walletSettings
  },
  Mutation: {
    updateWalletEncryption,
    resetWallets,
    setWalletPriority,
    disablePassphraseExport,
    setWalletSettings
  }
}

async function wallets (parent, args, { me, models }) {
  if (!me) {
    throw new GqlAuthenticationError()
  }

  let wallets = await models.wallet.findMany({
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

  wallets = wallets.map(mapWalletResolveTypes)
  walletTemplates = walletTemplates.map(t => {
    return {
      ...t,
      __resolveType: 'WalletTemplate'
    }
  })

  return [...wallets, ...walletTemplates]
}

async function wallet (parent, { id, name }, { me, models }) {
  if (!me) {
    throw new GqlAuthenticationError()
  }

  if (id) {
    const wallet = await models.wallet.findUnique({
      where: { id: Number(id), userId: me.id },
      include: {
        template: true,
        protocols: true
      }
    })
    return mapWalletResolveTypes(wallet)
  }

  const template = await models.walletTemplate.findFirst({ where: { name } })
  return { ...template, __resolveType: 'WalletTemplate' }
}

async function walletSettings (parent, args, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  return await models.user.findUnique({ where: { id: me.id } })
}

async function updateWalletEncryption (parent, { keyHash, wallets }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()
  if (!keyHash) throw new GqlInputError('hash required')

  const { vaultKeyHash: oldKeyHash } = await models.user.findUnique({ where: { id: me.id } })

  return await models.$transaction(async tx => {
    for (const { id: walletId, protocols } of wallets) {
      for (const { name, send, config } of protocols) {
        const mutation = upsertWalletProtocol({ name, send }, { networkTests: false })
        await mutation(parent, { walletId, ...config }, { me, tx })
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

async function resetWallets (parent, args, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  await models.$transaction(async tx => {
    const protocols = await tx.walletProtocol.findMany({
      where: {
        send: true,
        wallet: {
          userId: me.id
        }
      }
    })

    for (const protocol of protocols) {
      await removeWalletProtocol(parent, { id: protocol.id }, { me, tx })
    }

    await tx.user.update({
      where: { id: me.id },
      // TODO(wallet-v2): nullable vaultKeyHash column
      data: { vaultKeyHash: '', showPassphrase: true }
    })
  })

  return true
}

async function disablePassphraseExport (parent, args, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  await models.user.update({ where: { id: me.id }, data: { showPassphrase: false } })

  return true
}

async function setWalletPriority (parent, { id, priority }, { me, models }) {
  if (!me) {
    throw new GqlAuthenticationError()
  }

  // TODO(wallet-v2): use Wallet instead of Wallet table
  await models.wallet.update({ where: { userId: me.id, id: Number(id) }, data: { priority } })

  return true
}

async function setWalletSettings (parent, { settings }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  await validateSchema(walletSettingsSchema, settings)

  await models.user.update({ where: { id: me.id }, data: settings })

  return true
}
