import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { validateSchema } from '@/lib/validate'
import protocols from '@/wallets/lib/protocols'
import { protocolRelationName, isEncryptedField, protocolMutationName, protocolServerSchema } from '@/wallets/lib/util'
import { mapUserWalletResolveTypes } from '@/wallets/server/resolvers/util'
import { protocolTestCreateInvoice } from '@/wallets/server/protocols'
import { timeoutSignal, withTimeout } from '@/lib/time'
import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'

export const resolvers = {
  Mutation: Object.fromEntries(
    protocols.map(protocol => {
      return [
        protocolMutationName(protocol),
        upsertWalletProtocol(protocol)
      ]
    })
  )
}

function upsertWalletProtocol (protocol) {
  return async (parent, { walletId, templateId, ...args }, { me, models }) => {
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

    if (!protocol.send) {
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
