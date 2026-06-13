import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { utf8ByteLength } from '@/lib/validate'
import { protocolRelationName } from '@/wallets/lib/util'
import { mapWalletResolveTypes, parseWalletId } from '@/wallets/server/resolvers/util'
import { protocolTestCreateInvoice } from '@/wallets/server/protocols'
import { commitWithBadgeNotifications, updateWalletBadges } from '@/wallets/server/badges'
import {
  applyRemoves,
  assertVaultKeyUnchanged,
  decodeProtocolConfig,
  deleteWalletIfEmpty,
  hasEncryptedField,
  resolveWalletForSave,
  upsertProtocolInTransaction,
  validateProtocolConfig
} from '@/wallets/server/persist'
import { timeoutSignal } from '@/lib/time'
import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { decodeCursor, LIMIT, nextCursorEncoded } from '@/lib/cursor'
import { writeWalletLog } from '@/wallets/server/logger'
import { WalletValidationError } from '@/wallets/client/errors'

const MAX_WALLET_LOG_MESSAGE_BYTES = 4096

const WalletProtocolConfig = {
  __resolveType: config => config.__resolveType
}

export const resolvers = {
  WalletProtocolConfig,
  Query: {
    walletLogs
  },
  Mutation: {
    addWalletLog,
    saveWalletProtocols,
    testWalletRecvProtocol,
    deleteWalletLogs
  }
}

// Probe a receive protocol by asking it to mint a small invoice. The @oneOf
// `WalletRecvProtocolTestInput` guarantees exactly one branch is set and only
// lists recv branches, so we decode the relation name and forward the plaintext
// config to the provider probe.
export async function testWalletRecvProtocol (parent, { config: wrapper }, { me }) {
  if (!me) throw new GqlAuthenticationError()

  const { protocol, config } = decodeProtocolConfig(wrapper)
  if (protocol.send) {
    throw new GqlInputError(`unknown receive protocol: ${protocolRelationName(protocol)}`)
  }
  await validateProtocolConfig(protocol, config)

  let invoice
  try {
    invoice = await protocolTestCreateInvoice(
      protocol,
      config,
      { signal: timeoutSignal(WALLET_CREATE_INVOICE_TIMEOUT_MS) }
    )
  } catch (e) {
    if (e instanceof WalletValidationError) {
      throw new GqlInputError(e.message)
    }
    throw new GqlInputError('failed to create invoice: ' + e.message)
  }

  if (!invoice || !invoice.startsWith('lnbc')) {
    throw new GqlInputError('wallet returned invalid invoice')
  }

  return true
}

// Atomic configure-save: validate every upsert, then apply upserts + removes
// + last-protocol wallet deletion + badge updates inside a single transaction
// so the wallet can never land in a partially-saved state. The write mechanics
// live in @/wallets/server/persist.
export async function saveWalletProtocols (parent, { walletId, templateName, upserts = [], removeIds = [] }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  if (!walletId === !templateName) {
    throw new GqlInputError('exactly one of walletId and templateName is required')
  }
  if (upserts.length === 0 && removeIds.length === 0) {
    throw new GqlInputError('nothing to save')
  }
  if (templateName && removeIds.length > 0) {
    throw new GqlInputError('cannot remove protocols from a wallet that does not exist yet')
  }

  const { vaultKeyHash } = await models.user.findUnique({ where: { id: me.id } })

  // Pre-validate every upsert so we fail fast before any DB writes. GraphQL
  // @oneOf already guaranteed shape; this catches yup-level rules like
  // hex/length constraints and keyHash mismatches.
  const validatedUpserts = upserts.map(({ enabled, config: wrapper }) => {
    const { protocol, config } = decodeProtocolConfig(wrapper)
    return { protocol, enabled, config }
  })
  for (const { protocol, config } of validatedUpserts) {
    await validateProtocolConfig(protocol, config, { keyHash: vaultKeyHash })
  }

  // Only upserts that persist a vault-encrypted secret depend on the current vault key.
  const usesVaultKey = validatedUpserts.some(({ protocol, config }) => hasEncryptedField(protocol, config))

  const removeIdNumbers = removeIds.map(Number)

  const savedWalletId = await commitWithBadgeNotifications(models, async (tx) => {
    const resolvedWalletId = await resolveWalletForSave(tx, { walletId, templateName, userId: me.id })

    for (const { protocol, enabled, config } of validatedUpserts) {
      await upsertProtocolInTransaction({ tx, walletId: resolvedWalletId, userId: me.id, protocol, enabled, config })
    }
    await applyRemoves(tx, { removeIds: removeIdNumbers, walletId: resolvedWalletId, userId: me.id })

    // Guard against a passphrase rotation committing mid-save.
    if (usesVaultKey) await assertVaultKeyUnchanged(tx, me.id, vaultKeyHash)

    const deleted = await deleteWalletIfEmpty(tx, resolvedWalletId)
    return {
      value: deleted ? null : resolvedWalletId,
      notifications: await updateWalletBadges({ userId: me.id, tx })
    }
  })

  if (!savedWalletId) return null

  // Re-hydrate after the write transaction so callers receive the
  // materialized config produced by wallet_to_jsonb.
  const wallet = await models.wallet.findUnique({
    where: { id: savedWalletId, userId: me.id },
    include: {
      template: true,
      protocols: {
        orderBy: {
          id: 'asc'
        }
      }
    }
  })

  return wallet ? mapWalletResolveTypes(wallet) : null
}

async function walletLogs (parent, { walletId, payInId, cursor }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  const decodedCursor = decodeCursor(cursor)
  const where = {
    userId: me.id,
    createdAt: {
      lt: decodedCursor.time
    },
    level: { not: 'DEBUG' }
  }

  if (walletId !== undefined) {
    const walletIdNumber = parseWalletId(walletId)
    where.protocol = {
      walletId: walletIdNumber,
      wallet: {
        userId: me.id
      }
    }
  }
  if (payInId !== undefined) {
    where.payInId = payInId
  }

  const logs = await models.walletLog.findMany({
    where,
    orderBy: {
      createdAt: 'desc'
    },
    take: LIMIT,
    skip: decodedCursor.offset,
    include: {
      protocol: {
        include: {
          wallet: {
            include: {
              template: true
            }
          }
        }
      }
    }
  })

  return {
    logs: logs.map(log => {
      const protocol = log.protocol && Number(log.protocol.wallet.userId) === Number(me.id)
        ? log.protocol
        : null

      return {
        ...log,
        protocol,
        ...(protocol
          ? {
              wallet: {
                ...protocol.wallet,
                name: protocol.wallet.template.name
              }
            }
          : {})
      }
    }),
    cursor: logs.length === LIMIT ? nextCursorEncoded(decodedCursor, LIMIT) : null
  }
}

async function addWalletLog (parent, { protocolId, level, message, timestamp, payInId, updateStatus }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  if (utf8ByteLength(message) > MAX_WALLET_LOG_MESSAGE_BYTES) {
    throw new GqlInputError('wallet log message is too long')
  }

  if (protocolId != null) {
    const protocol = await models.walletProtocol.findFirst({
      where: {
        id: Number(protocolId),
        wallet: {
          userId: me.id
        }
      },
      select: {
        id: true
      }
    })

    if (!protocol) {
      throw new GqlInputError('wallet protocol not found')
    }
  }
  if (payInId != null) {
    const payIn = await models.payIn.findFirst({
      where: {
        id: Number(payInId),
        userId: me.id
      },
      select: {
        id: true
      }
    })

    if (!payIn) {
      throw new GqlInputError('payIn not found')
    }
  }

  await writeWalletLog({ models, protocolId, userId: me.id, payInId, level, message, createdAt: timestamp, updateStatus })

  return true
}

async function deleteWalletLogs (parent, { walletId }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  const where = {
    userId: me.id
  }

  if (walletId != null) {
    const walletIdNumber = parseWalletId(walletId)

    const wallet = await models.wallet.findFirst({
      where: {
        id: walletIdNumber,
        userId: me.id
      },
      select: {
        id: true
      }
    })

    if (!wallet) throw new GqlInputError('wallet not found')

    where.protocol = {
      walletId: walletIdNumber,
      wallet: {
        userId: me.id
      }
    }
  }

  await models.walletLog.deleteMany({
    where
  })

  return true
}
