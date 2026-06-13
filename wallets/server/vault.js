import { GqlInputError } from '@/lib/error'

// Vault / passphrase metadata helpers for the wallet encryption flows (key init,
// passphrase rotation, reset), driven by the resolvers in resolvers/wallet.js.

export async function getVaultMetadata (models, userId) {
  return await models.user.findUnique({
    where: { id: userId },
    select: {
      vaultKeyHash: true
    }
  })
}

export async function setVaultShowPassphrase (tx, { userId, showPassphrase }) {
  return await tx.user.update({
    where: { id: userId },
    data: { showPassphrase }
  })
}

export async function updateVaultMetadata (tx, { userId, currentKeyHash, keyHash, showPassphrase }) {
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
      vaultKeyHashUpdatedAt: new Date()
    }
  })
}

export async function initializeVaultKeyHash (models, { userId, keyHash }) {
  const count = await models.$executeRaw`
    UPDATE users
    SET "vaultKeyHash" = ${keyHash}, "vaultKeyHashUpdatedAt" = NOW()
    WHERE id = ${userId}
    AND "vaultKeyHash" = ''
  `

  return count > 0
}

export async function assertRotationPayloadCoversSendProtocols (tx, { userId, updatedSendProtocolIds }) {
  const currentSendProtocolCount = await tx.walletProtocol.count({
    where: {
      send: true,
      wallet: {
        userId
      }
    }
  })

  if (currentSendProtocolCount !== updatedSendProtocolIds.size) throw new GqlInputError('wallet changed, please retry rotation')
}
