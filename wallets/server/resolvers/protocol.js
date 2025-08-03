import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { validateSchema } from '@/lib/validate'
import protocols from '@/wallets/lib/protocols'
import { protocolRelationName, isEncryptedField, protocolMutationName, protocolServerSchema, protocolTestMutationName } from '@/wallets/lib/util'
import { mapWalletResolveTypes } from '@/wallets/server/resolvers/util'
import { protocolTestCreateInvoice } from '@/wallets/server/protocols'
import { timeoutSignal, withTimeout } from '@/lib/time'
import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { notifyNewStreak, notifyStreakLost } from '@/lib/webPush'
import { decodeCursor, LIMIT, nextCursorEncoded } from '@/lib/cursor'
import { logContextFromBolt11, walletLogger } from '@/wallets/server/logger'
import { formatMsats } from '@/lib/format'

const WalletProtocolConfig = {
  __resolveType: config => config.__resolveType
}

const WalletLogEntry = {
  context: async ({ level, context, invoice, withdrawal }, args, { me }) => {
    const isError = ['error', 'warn'].includes(level.toLowerCase())

    if (withdrawal && me?.id === withdrawal.userId) {
      return {
        ...await logContextFromBolt11(withdrawal.bolt11),
        ...(withdrawal.preimage ? { preimage: withdrawal.preimage } : {}),
        ...(isError ? { max_fee: formatMsats(withdrawal.msatsFeePaying) } : {})
      }
    }

    if (invoice && me?.id === invoice.userId) {
      return await logContextFromBolt11(invoice.bolt11)
    }

    return context
  }
}

export const resolvers = {
  WalletProtocolConfig,
  WalletLogEntry,
  Query: {
    walletLogs
  },
  Mutation: {
    ...Object.fromEntries(
      protocols.reduce((acc, protocol) => {
        return [
          ...acc,
          [
            protocolMutationName(protocol),
            upsertWalletProtocol(protocol)
          ],
          ...(protocol.send
            ? []
            : [
                [
                  protocolTestMutationName(protocol),
                  testWalletProtocol(protocol)
                ]
              ])
        ]
      }, [])
    ),
    addWalletLog,
    removeWalletProtocol,
    deleteWalletLogs
  }
}

function testWalletProtocol (protocol) {
  return async (parent, args, { me, models, tx }) => {
    if (!me) {
      throw new GqlAuthenticationError()
    }

    if (protocol.send) {
      throw new GqlInputError('can only test receive protocols')
    }

    let invoice
    try {
      invoice = await withTimeout(
        protocolTestCreateInvoice(
          protocol,
          args,
          { signal: timeoutSignal(WALLET_CREATE_INVOICE_TIMEOUT_MS) }
        ),
        WALLET_CREATE_INVOICE_TIMEOUT_MS
      )
    } catch (e) {
      throw new GqlInputError('failed to create invoice: ' + e.message)
    }

    if (!invoice || !invoice.startsWith('lnbc')) {
      throw new GqlInputError('wallet returned invalid invoice')
    }

    return true
  }
}

export function upsertWalletProtocol (protocol) {
  return async (parent, {
    walletId,
    templateName,
    enabled,
    ignoreKeyHash = false,
    ...args
  }, { me, models, tx }) => {
    if (!me) {
      throw new GqlAuthenticationError()
    }

    if (!walletId && !templateName) {
      throw new GqlInputError('walletId or templateName is required')
    }

    const { vaultKeyHash: existingKeyHash } = await models.user.findUnique({ where: { id: me.id } })

    const schema = protocolServerSchema(protocol, { keyHash: existingKeyHash, ignoreKeyHash })
    try {
      await validateSchema(schema, args)
    } catch (e) {
      // TODO(wallet-v2): on length errors, error message includes path twice like this:
      //   "apiKey.iv: apiKey.iv must be exactly 32 characters"
      throw new GqlInputError(e.message)
    }

    const relation = protocolRelationName(protocol)

    function dataFragment (args, type) {
      return Object.fromEntries(
        Object.entries(args).map(
          ([key, value]) => {
            if (isEncryptedField(protocol, key)) {
              return [key, { [type]: { value: value.value, iv: value.iv } }]
            }
            return [key, value]
          }
        )
      )
    }

    // Prisma does not support nested transactions so we need to check manually if we were given a transaction
    // https://github.com/prisma/prisma/issues/15212
    async function transaction (tx) {
      if (templateName) {
        const { id: newWalletId } = await tx.wallet.create({
          data: {
            templateName,
            userId: me.id
          }
        })
        walletId = newWalletId
      }

      const wallet = await tx.wallet.update({
        where: {
          id: Number(walletId),
          // this makes sure that users can only update their own wallets
          // (the update will fail in this case and abort the transaction)
          userId: me.id
        },
        data: {
          protocols: {
            upsert: {
              where: {
                WalletProtocol_walletId_send_name_key: {
                  walletId: Number(walletId),
                  send: protocol.send,
                  name: protocol.name
                }
              },
              update: {
                enabled,
                [relation]: {
                  update: dataFragment(args, 'update')
                }
              },
              create: {
                enabled,
                send: protocol.send,
                name: protocol.name,
                [relation]: {
                  create: dataFragment(args, 'create')
                }
              }
            }
          }
        },
        include: {
          protocols: true
        }
      })
      // XXX Prisma seems to run the vault update AFTER the update of the table that points to it
      //   which means our trigger to set the jsonb column in the WalletProtocol table does not see
      //   the updated vault entry.
      //   To fix this, we run another update to force the trigger to run again.
      // TODO(wallet-v2): fix this in a better way?
      await tx.walletProtocol.update({
        where: {
          WalletProtocol_walletId_send_name_key: {
            walletId: Number(walletId),
            send: protocol.send,
            name: protocol.name
          }
        },
        data: {
          [relation]: {
            update: {
              updatedAt: new Date()
            }
          }
        }
      })

      await updateWalletBadges({ userId: me.id, tx })

      return mapWalletResolveTypes(wallet)
    }

    return await (tx ? transaction(tx) : models.$transaction(transaction))
  }
}

export async function removeWalletProtocol (parent, { id }, { me, models, tx }) {
  if (!me) {
    throw new GqlAuthenticationError()
  }

  async function transaction (tx) {
    // vault is deleted via trigger
    const protocol = await tx.walletProtocol.delete({
      where: {
        id: Number(id),
        wallet: {
          userId: me.id
        }
      }
    })

    const wallet = await tx.wallet.findUnique({
      where: {
        id: protocol.walletId
      },
      include: {
        protocols: true
      }
    })
    if (wallet.protocols.length === 0) {
      await tx.wallet.delete({
        where: {
          id: wallet.id
        }
      })
    }

    await updateWalletBadges({ userId: me.id, tx })

    return true
  }

  return await (tx ? transaction(tx) : models.$transaction(transaction))
}

async function walletLogs (parent, { protocolId, cursor, debug }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  const decodedCursor = decodeCursor(cursor)

  const logs = await models.walletLog.findMany({
    where: {
      userId: me.id,
      protocolId,
      createdAt: {
        lt: decodedCursor.time
      },
      level: debug ? 'DEBUG' : { not: 'DEBUG' }
    },
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
      },
      invoice: true,
      withdrawal: true
    }
  })

  return {
    entries: logs.map(log => ({
      ...log,
      ...(log.protocol
        ? {
            wallet: {
              ...log.protocol.wallet,
              name: log.protocol.wallet.template.name
            }
          }
        : {})
    })),
    cursor: logs.length === LIMIT ? nextCursorEncoded(decodedCursor, LIMIT) : null
  }
}

async function addWalletLog (parent, { protocolId, level, message, timestamp, invoiceId }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  const logger = walletLogger({ models, protocolId, userId: me.id, invoiceId })
  await logger[level.toLowerCase()](message, { createdAt: timestamp })

  return true
}

async function deleteWalletLogs (parent, { protocolId, debug }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  await models.walletLog.deleteMany({
    where: {
      userId: me.id,
      protocolId,
      level: debug ? 'DEBUG' : { not: 'DEBUG' }
    }
  })

  return true
}

async function updateWalletBadges ({ userId, tx }) {
  const pushNotifications = []

  const wallets = await tx.wallet.findMany({
    where: {
      userId
    },
    include: {
      protocols: true
    }
  })

  const { hasRecvWallet: oldHasRecvWallet, hasSendWallet: oldHasSendWallet } = await tx.user.findUnique({ where: { id: userId } })

  const newHasRecvWallet = wallets.some(({ protocols }) => protocols.some(({ send, enabled }) => !send && enabled))
  const newHasSendWallet = wallets.some(({ protocols }) => protocols.some(({ send, enabled }) => send && enabled))

  await tx.user.update({
    where: { id: userId },
    data: {
      hasRecvWallet: newHasRecvWallet,
      hasSendWallet: newHasSendWallet
    }
  })

  const startStreak = async (type) => {
    const streak = await tx.streak.create({
      data: { userId, type, startedAt: new Date() }
    })
    return streak.id
  }

  const endStreak = async (type) => {
    const [streak] = await tx.$queryRaw`
        UPDATE "Streak"
        SET "endedAt" = now(), updated_at = now()
        WHERE "userId" = ${userId}
        AND "type" = ${type}::"StreakType"
        AND "endedAt" IS NULL
        RETURNING "id"
      `
    return streak?.id
  }

  if (!oldHasRecvWallet && newHasRecvWallet) {
    const streakId = await startStreak('HORSE')
    if (streakId) pushNotifications.push(() => notifyNewStreak(userId, { type: 'HORSE', id: streakId }))
  }
  if (!oldHasSendWallet && newHasSendWallet) {
    const streakId = await startStreak('GUN')
    if (streakId) pushNotifications.push(() => notifyNewStreak(userId, { type: 'GUN', id: streakId }))
  }

  if (oldHasRecvWallet && !newHasRecvWallet) {
    const streakId = await endStreak('HORSE')
    if (streakId) pushNotifications.push(() => notifyStreakLost(userId, { type: 'HORSE', id: streakId }))
  }
  if (oldHasSendWallet && !newHasSendWallet) {
    const streakId = await endStreak('GUN')
    if (streakId) pushNotifications.push(() => notifyStreakLost(userId, { type: 'GUN', id: streakId }))
  }

  // run all push notifications at the end to make sure we don't
  // accidentally send push notifications even if transaction fails
  Promise.all(pushNotifications.map(notify => notify())).catch(console.error)
}
