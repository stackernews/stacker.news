import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { protocolRelationName, isEncryptedField } from '@/wallets/lib/util'
import { mapUserWalletResolveTypes } from '@/wallets/server/resolvers/util'

export const resolvers = {
  Mutation: {
    upsertWalletSendLNbits: upsertWalletProtocol({ name: 'LNBITS', send: true }),
    upsertWalletRecvLNbits: upsertWalletProtocol({ name: 'LNBITS', send: false })
  }
}

function upsertWalletProtocol (protocol) {
  return async (parent, { walletId, templateId, ...args }, { me, models }) => {
    if (!me) {
      throw new GqlAuthenticationError()
    }

    if (!walletId && !templateId) {
      throw new GqlInputError('walletId or templateId is required')
    }

    const relation = protocolRelationName(protocol)

    function toFragment (args) {
      return Object.fromEntries(
        Object.entries(args).map(
          ([key, value]) => {
            if (isEncryptedField(protocol, key)) {
              return [key, { update: { value: value.value, iv: value.iv } }]
            }
            return [key, value]
          }
        )
      )
    }

    const dataFragment = toFragment(args)

    if (walletId) {
      const [userWallet] = await models.$transaction([
        models.userWallet.update({
          where: {
            id: Number(walletId),
            // this makes sure that users can only update their own wallets
            // (the update will fail in this case and abort the transaction)
            userId: me.id
          },
          data: {
            protocols: {
              update: {
                where: {
                  ProtocolWallet_walletId_send_protocol_key: {
                    walletId: Number(walletId),
                    send: protocol.send,
                    protocol: protocol.name
                  }
                },
                data: {
                  [relation]: {
                    update: dataFragment
                  }
                }
              }
            }
          },
          include: {
            protocols: true
          }
        }),
        // XXX Prisma seems to run the vault update AFTER the update of the table that points to it
        //   which means our trigger to set the jsonb column in the ProtocolWallet table does not see
        //   the updated vault entry.
        //   To fix this, we run a protocol wallet update to force the trigger to run again.
        // TODO(wallet-v2): fix this in a better way?
        models.protocolWallet.update({
          where: {
            ProtocolWallet_walletId_send_protocol_key: {
              walletId: Number(walletId),
              send: protocol.send,
              protocol: protocol.name
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
      ])

      return mapUserWalletResolveTypes(userWallet)
    }

    // TODO(wallet-v2): create new wallet from template
  }
}
