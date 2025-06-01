import { GqlInputError } from '@/lib/error'
import { protocolRelationName, isEncryptedField } from '@/wallets/lib/util'
import { mapUserWalletResolveTypes } from '@/wallets/server/resolvers/util'

export const resolvers = {
  Mutation: {
    upsertWalletSendLNbits,
    upsertWalletRecvLNbits
  }
}

// TODO(wallet-v2): generate these resolvers
async function upsertWalletSendLNbits (parent, { walletId, templateId, url, apiKey }, { me, models }) {
  // TODO(wallet-v2): validate and test with HOLD invoice

  if (!walletId && !templateId) {
    throw new GqlInputError('walletId or templateId is required')
  }

  if (walletId) {
    return await updateWallet({
      walletId: Number(walletId),
      protocol: { name: 'LNBITS', send: true },
      data: { url, apiKey }
    }, { models })
  }

  // TODO(wallet-v2): create new wallet from template
}

async function upsertWalletRecvLNbits (parent, { walletId, templateId, url, apiKey }, { me, models }) {
  // TODO(wallet-v2): validate and test with HOLD invoice

  if (!walletId && !templateId) {
    throw new GqlInputError('walletId or templateId is required')
  }

  if (walletId) {
    return await updateWallet({
      walletId: Number(walletId),
      protocol: { name: 'LNBITS', send: false },
      data: { url, apiKey }
    }, { models })
  }

  // TODO(wallet-v2): create new wallet from template
}

async function updateWallet ({ walletId, protocol, data }, { models }) {
  const relation = protocolRelationName(protocol)

  function toFragment (data) {
    return Object.fromEntries(
      Object.entries(data).map(
        ([key, value]) => {
          if (isEncryptedField(protocol, key)) {
            return [key, { update: { value: value.value, iv: value.iv } }]
          }
          return [key, value]
        }
      )
    )
  }

  const dataFragment = toFragment(data)

  const [userWallet] = await models.$transaction([
    models.userWallet.update({
      where: { id: Number(walletId) },
      data: {
        protocols: {
          update: {
            where: {
              ProtocolWallet_walletId_send_protocol_key: {
                walletId,
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
          walletId,
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
