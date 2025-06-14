import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { validateSchema } from '@/lib/validate'
import protocols from '@/wallets/lib/protocols'
import { protocolRelationName, isEncryptedField, protocolMutationName, protocolServerSchema } from '@/wallets/lib/util'
import { mapUserWalletResolveTypes } from '@/wallets/server/resolvers/util'
import { protocolTestCreateInvoice } from '@/wallets/server/protocols'
import { timeoutSignal, withTimeout } from '@/lib/time'
import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'

const WalletProtocolConfig = {
  __resolveType: config => config.__resolveType
}

export const resolvers = {
  WalletProtocolConfig,
  Mutation: {
    ...Object.fromEntries(
      protocols.map(protocol => {
        return [
          protocolMutationName(protocol),
          upsertWalletProtocol(protocol)
        ]
      })
    ),
    removeWalletProtocol
  }
}

export function upsertWalletProtocol (protocol, { networkTests = true } = {}) {
  return async (parent, { walletId, templateId, ...args }, { me, models, tx }) => {
    if (!me) {
      throw new GqlAuthenticationError()
    }

    if (!walletId && !templateId) {
      throw new GqlInputError('walletId or templateId is required')
    }

    const schema = protocolServerSchema(protocol)
    try {
      await validateSchema(schema, args)
    } catch (e) {
      // TODO(wallet-v2): on length errors, error message includes path twice like this:
      //   "apiKey.iv: apiKey.iv must be exactly 32 characters"
      throw new GqlInputError(e.message)
    }

    if (!protocol.send && networkTests) {
      let invoice
      try {
        invoice = await withTimeout(
          protocolTestCreateInvoice(protocol, args, { signal: timeoutSignal(WALLET_CREATE_INVOICE_TIMEOUT_MS) }),
          WALLET_CREATE_INVOICE_TIMEOUT_MS
        )
      } catch (e) {
        throw new GqlInputError('failed to create test invoice: ' + e.message)
      }

      if (!invoice || !invoice.startsWith('lnbc')) {
        throw new GqlInputError('wallet returned invalid invoice')
      }
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
      if (templateId) {
        const { id: newWalletId } = await tx.userWallet.create({
          data: {
            templateId: Number(templateId),
            userId: me.id
          }
        })
        walletId = newWalletId
      }

      const userWallet = await tx.userWallet.update({
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
                ProtocolWallet_walletId_send_name_key: {
                  walletId: Number(walletId),
                  send: protocol.send,
                  name: protocol.name
                }
              },
              update: {
                [relation]: {
                  update: dataFragment(args, 'update')
                }
              },
              create: {
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
      //   which means our trigger to set the jsonb column in the ProtocolWallet table does not see
      //   the updated vault entry.
      //   To fix this, we run a protocol wallet update to force the trigger to run again.
      // TODO(wallet-v2): fix this in a better way?
      await tx.protocolWallet.update({
        where: {
          ProtocolWallet_walletId_send_name_key: {
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

      return mapUserWalletResolveTypes(userWallet)
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
    const protocol = await tx.protocolWallet.delete({
      where: {
        id: Number(id),
        wallet: {
          userId: me.id
        }
      }
    })

    const userWallet = await tx.userWallet.findUnique({
      where: {
        id: protocol.walletId
      },
      include: {
        protocols: true
      }
    })
    if (userWallet.protocols.length === 0) {
      await tx.userWallet.delete({
        where: {
          id: userWallet.id
        }
      })
    }

    return true
  }

  return await (tx ? transaction(tx) : models.$transaction(transaction))
}
