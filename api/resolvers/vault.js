import { E_VAULT_KEY_EXISTS, GqlAuthenticationError, GqlInputError } from '@/lib/error'

export default {
  Query: {
    getVaultEntry: async (parent, { key }, { me, models }, info) => {
      if (!me) throw new GqlAuthenticationError()
      if (!key) throw new GqlInputError('must have key')

      const k = await models.vault.findUnique({
        where: {
          key,
          userId: me.id
        }
      })
      return k
    },
    getVaultEntries: async (parent, { keysFilter }, { me, models }, info) => {
      if (!me) throw new GqlAuthenticationError()

      const entries = await models.vaultEntry.findMany({
        where: {
          userId: me.id,
          key: keysFilter?.length
            ? {
                in: keysFilter
              }
            : undefined
        }
      })
      return entries
    }
  },
  Mutation: {
    // atomic vault migration
    updateVaultKey: async (parent, { entries, hash }, { me, models }) => {
      if (!me) throw new GqlAuthenticationError()
      if (!hash) throw new GqlInputError('hash required')
      const txs = []

      const { vaultKeyHash: oldKeyHash } = await models.user.findUnique({ where: { id: me.id } })
      if (oldKeyHash) {
        if (oldKeyHash !== hash) {
          throw new GqlInputError('vault key already set', E_VAULT_KEY_EXISTS)
        } else {
          return true
        }
      } else {
        txs.push(models.user.update({
          where: { id: me.id },
          data: { vaultKeyHash: hash }
        }))
      }

      for (const entry of entries) {
        txs.push(models.vaultEntry.update({
          where: { userId_key: { userId: me.id, key: entry.key } },
          data: { value: entry.value, iv: entry.iv }
        }))
      }
      await models.$transaction(txs)
      return true
    },
    clearVault: async (parent, args, { me, models }) => {
      if (!me) throw new GqlAuthenticationError()
      const txs = []
      txs.push(models.user.update({
        where: { id: me.id },
        data: { vaultKeyHash: '' }
      }))
      txs.push(models.vaultEntry.deleteMany({ where: { userId: me.id } }))
      await models.$transaction(txs)
      return true
    }
  }
}
