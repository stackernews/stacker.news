import { E_VAULT_KEY_EXISTS, GqlAuthenticationError, GqlInputError } from '@/lib/error'

export default {
  Query: {
    getVaultEntries: async (parent, args, { me, models }) => {
      // TODO(wallet-v2): this is probably not needed anymore
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
        // TODO(wallet-v2): use UserWallet instead of Wallet table
        // const wallets = await tx.wallet.findMany({ where: { userId: me.id } })
        // TODO(wallet-v2): implement this
        // for (const wallet of wallets) {
        // }

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

      // TODO(wallet-v2): use UserWallet instead of Wallet table
      // const wallets = await models.wallet.findMany({ where: { userId: me.id } })
      // txs.push(...wallets.filter(hasVault).map(wallet => deleteVault(models, wallet)))

      await models.$transaction(txs)
      return true
    }
  }
}
