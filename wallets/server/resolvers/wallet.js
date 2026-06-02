import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { mapWalletResolveTypes } from '@/wallets/server/resolvers/util'
import { updateExistingProtocolConfigInTransaction } from '@/wallets/server/persist'
import { assertRotationPayloadCoversSendProtocols, getVaultMetadata, initializeVaultKeyHash, setVaultShowPassphrase, updateVaultMetadata } from '@/wallets/server/vault'
import { commitWithBadgeNotifications, updateWalletBadges } from '@/wallets/server/badges'
import { validateSchema, walletSettingsSchema } from '@/lib/validate'

const WalletOrTemplate = {
  __resolveType: walletOrTemplate => walletOrTemplate.__resolveType
}

const Wallet = {
  name: wallet => wallet.template.name,
  send: wallet => walletStatus(wallet, 'send'),
  receive: wallet => walletStatus(wallet, 'receive')
}

const WalletTemplate = {
  send: walletTemplate => walletTemplate.sendProtocols.length > 0 ? 'OK' : 'DISABLED',
  receive: walletTemplate => walletTemplate.recvProtocols.length > 0 ? 'OK' : 'DISABLED',
  protocols: walletTemplate => {
    return [
      ...walletTemplate.sendProtocols.map(protocol => ({
        id: `WalletTemplate-${walletTemplate.name}-${protocol}-send`,
        name: protocol,
        send: true
      })),
      ...walletTemplate.recvProtocols.map(protocol => ({
        id: `WalletTemplate-${walletTemplate.name}-${protocol}-recv`,
        name: protocol,
        send: false
      }))
    ]
  }
}

const walletInclude = {
  template: true,
  protocols: {
    orderBy: {
      id: 'asc'
    }
  }
}

export const resolvers = {
  WalletOrTemplate,
  Wallet,
  WalletTemplate,
  Query: {
    wallets,
    walletSettings
  },
  Mutation: {
    updateWalletEncryption,
    updateKeyHash,
    resetWallets,
    setWalletPriorities,
    disablePassphraseExport,
    setWalletSettings,
    deleteWallet
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
    include: walletInclude,
    orderBy: [
      { priority: 'asc' },
      { id: 'asc' }
    ]
  })

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

function walletStatus (wallet, type) {
  const protocols = wallet.protocols.filter(protocol => type === 'send' ? protocol.send : !protocol.send)

  // Roll up over enabled protocols only: a disabled protocol's stale status must
  // not drag an otherwise-OK side to WARNING.
  const active = protocols.filter(protocol => protocol.enabled)
  if (active.length === 0) return 'DISABLED'
  if (active.every(protocol => protocol.status === 'OK')) return 'OK'
  if (active.every(protocol => protocol.status === 'ERROR')) return 'ERROR'
  return 'WARNING'
}

async function walletSettings (parent, args, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  return await models.user.findUnique({ where: { id: me.id } })
}

async function updateWalletEncryption (parent, { keyHash, wallets }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()
  if (!keyHash) throw new GqlInputError('hash required')

  const { vaultKeyHash: oldKeyHash } = await getVaultMetadata(models, me.id)

  return await models.$transaction(async tx => {
    const updatedSendProtocolIds = new Set()

    for (const { id: walletId, protocols } of wallets) {
      for (const { name, send, config } of protocols) {
        const { id: protocolId } = await updateExistingProtocolConfigInTransaction({ tx, walletId, userId: me.id, name, send, config, keyHash })
        if (send) updatedSendProtocolIds.add(protocolId)
      }
    }

    await assertRotationPayloadCoversSendProtocols(tx, { userId: me.id, updatedSendProtocolIds })

    // optimistic concurrency control:
    // make sure the user's vault key didn't change while we were updating the protocols
    await updateVaultMetadata(tx, {
      userId: me.id,
      currentKeyHash: oldKeyHash,
      keyHash,
      showPassphrase: false
    })

    return true
  })
}

async function updateKeyHash (parent, { keyHash }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()
  if (!keyHash) throw new GqlInputError('hash required')

  return await initializeVaultKeyHash(models, { userId: me.id, keyHash })
}

async function deleteWallet (parent, { id }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  await commitWithBadgeNotifications(models, async tx => {
    await tx.wallet.delete({ where: { id: Number(id), userId: me.id } })
    return { value: null, notifications: await updateWalletBadges({ userId: me.id, tx }) }
  })

  return true
}

async function resetWallets (parent, { newKeyHash }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()
  if (!newKeyHash) throw new GqlInputError('hash required')

  const { vaultKeyHash: oldHash } = await getVaultMetadata(models, me.id)

  await commitWithBadgeNotifications(models, async tx => {
    // vaults are deleted via trigger
    await tx.walletProtocol.deleteMany({
      where: { send: true, wallet: { userId: me.id } }
    })

    // Drop any wallets that lost their last protocol so the user is not left
    // with empty stubs after a reset.
    await tx.wallet.deleteMany({
      where: { userId: me.id, protocols: { none: {} } }
    })

    const notifications = await updateWalletBadges({ userId: me.id, tx })

    // TODO(wallet-v2): nullable vaultKeyHash column
    await updateVaultMetadata(tx, {
      userId: me.id,
      currentKeyHash: oldHash,
      keyHash: newKeyHash,
      showPassphrase: true
    })

    return { value: null, notifications }
  })

  return true
}

async function disablePassphraseExport (parent, args, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  await setVaultShowPassphrase(models, { userId: me.id, showPassphrase: false })

  return true
}

async function setWalletPriorities (parent, { priorities }, { me, models }) {
  if (!me) {
    throw new GqlAuthenticationError()
  }

  await models.$transaction(async tx => {
    for (const { id, priority } of priorities) {
      await tx.wallet.update({
        where: { userId: me.id, id: Number(id) },
        data: { priority }
      })
    }
  })

  return true
}

async function setWalletSettings (parent, { settings }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  await validateSchema(walletSettingsSchema, settings)

  await models.user.update({ where: { id: me.id }, data: settings })

  return settings
}
