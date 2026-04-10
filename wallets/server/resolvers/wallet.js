import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { mapWalletResolveTypes } from '@/wallets/server/resolvers/util'
import { removeWalletProtocol, upsertWalletProtocol, updateWalletBadges } from './protocol'
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

async function getVaultMetadata (models, userId) {
  return await models.user.findUnique({
    where: { id: userId },
    select: {
      vaultKeyHash: true,
      vaultKeyHashUpdatedAt: true,
      showPassphrase: true
    }
  })
}

async function setVaultShowPassphrase (tx, { userId, showPassphrase }) {
  return await tx.user.update({
    where: { id: userId },
    data: { showPassphrase }
  })
}

async function updateVaultMetadata (tx, { userId, currentKeyHash, keyHash, showPassphrase, updatedAt = new Date() }) {
  if (currentKeyHash === undefined) {
    throw new TypeError('currentKeyHash required')
  }
  if (!keyHash) {
    throw new TypeError('keyHash required')
  }

  return await tx.user.update({
    where: { id: userId, vaultKeyHash: currentKeyHash },
    data: {
      vaultKeyHash: keyHash,
      showPassphrase,
      vaultKeyHashUpdatedAt: updatedAt
    }
  })
}

async function initializeVaultKeyHash (models, { userId, keyHash }) {
  const count = await models.$executeRaw`
    UPDATE users
    SET "vaultKeyHash" = ${keyHash}, "vaultKeyHashUpdatedAt" = NOW()
    WHERE id = ${userId}
    AND "vaultKeyHash" = ''
  `

  return count > 0
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

  const disabled = protocols.every(protocol => !protocol.enabled)
  if (disabled) return 'DISABLED'

  const ok = protocols.every(protocol => protocol.status === 'OK')
  if (ok) return 'OK'

  const error = protocols.every(protocol => protocol.status === 'ERROR')
  if (error) return 'ERROR'

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
    for (const { id: walletId, protocols } of wallets) {
      for (const { name, send, config } of protocols) {
        const mutation = upsertWalletProtocol({ name, send })
        await mutation(parent, { walletId, ignoreKeyHash: true, ...config }, { me, models: tx, tx })
      }
    }

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

  await models.$transaction(async tx => {
    await tx.wallet.delete({ where: { id: Number(id), userId: me.id } })
    await updateWalletBadges({ userId: me.id, tx })
  })

  return true
}

async function resetWallets (parent, { newKeyHash }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()
  if (!newKeyHash) throw new GqlInputError('hash required')

  const { vaultKeyHash: oldHash } = await getVaultMetadata(models, me.id)

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

    // TODO(wallet-v2): nullable vaultKeyHash column
    await updateVaultMetadata(tx, {
      userId: me.id,
      currentKeyHash: oldHash,
      keyHash: newKeyHash,
      showPassphrase: true
    })
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
