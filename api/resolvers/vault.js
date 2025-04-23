import { E_VAULT_KEY_EXISTS, GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { getWalletByType } from '@/wallets/common'
import { deleteVault, hasVault, vaultNewSchematoTypedef, vaultPrismaFragments } from '@/wallets/vault'

export default {
  Query: {
    getVaultEntries: async (parent, args, { me, models }) => {
      if (!me) throw new GqlAuthenticationError()

      const wallets = await models.wallet.findMany({
        where: { userId: me.id },
        include: vaultPrismaFragments.include()
      })

      const vaultEntries = []
      for (const wallet of wallets) {
        vaultEntries.push(...vaultNewSchematoTypedef(wallet).vaultEntries)
      }

      return vaultEntries
    }
  },
  Mutation: {
    // atomic vault migration
    updateVaultKey: async (parent, { entries, hash }, { me, models }) => {
      if (!me) throw new GqlAuthenticationError()
      if (!hash) throw new GqlInputError('hash required')

      const { vaultKeyHash: oldKeyHash } = await models.user.findUnique({ where: { id: me.id } })
      if (oldKeyHash) {
        if (oldKeyHash === hash) {
          return true
        }
        throw new GqlInputError('vault key already set', E_VAULT_KEY_EXISTS)
      }

      return await models.$transaction(async tx => {
        const wallets = await tx.wallet.findMany({ where: { userId: me.id } })
        for (const wallet of wallets) {
          const def = getWalletByType(wallet.type)
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              [def.walletField]: {
                update: vaultPrismaFragments.upsert({ ...wallet, vaultEntries: entries })
              }
            }
          })
        }

        // optimistic concurrency control: make sure the user's vault key didn't change while we were updating the wallets
        await tx.user.update({
          where: { id: me.id, vaultKeyHash: oldKeyHash },
          data: { vaultKeyHash: hash }
        })

        return true
      })
    },
    clearVault: async (parent, args, { me, models }) => {
      if (!me) throw new GqlAuthenticationError()
      const txs = []
      txs.push(models.user.update({
        where: { id: me.id },
        data: { vaultKeyHash: '' }
      }))

      const wallets = await models.wallet.findMany({ where: { userId: me.id } })
      txs.push(...wallets.filter(hasVault).map(wallet => deleteVault(models, wallet)))

      await models.$transaction(txs)
      return true
    }
  }
}
