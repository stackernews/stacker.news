import { E_VAULT_KEY_EXISTS, GqlAuthenticationError, GqlInputError } from '@/lib/error'

export default {
  Query: {
    getVaultEntry: async (parent, { key }, { me, models }) => {
      if (!key) {
        throw new GqlInputError('must have key')
      }
      // return await models.userVault.findUnique({ where: { key, userId: me.id } })
      const k = await models.userVault.findFirst({ where: { key, userId: me.id } })
      return k
    }
  },

  Mutation: {
    setVaultKeyHash: async (parent, { hash }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }
      if (!hash) {
        throw new GqlInputError('hash required')
      }
      const oldKeyHash = await models.user.findUnique({ where: { id: me.id } }).then(u => u.vaultKeyHash)
      if (oldKeyHash) {
        if (oldKeyHash !== hash) {
          throw new GqlInputError('vault key already set', E_VAULT_KEY_EXISTS)
        } else {
          return true
        }
      } else {
        await models.user.update({
          where: { id: me.id },
          data: { vaultKeyHash: hash }
        })
      }
      return true
    },
    setVaultEntry: async (parent, { key, value }, { me, models }) => {
      if (!key) {
        throw new GqlInputError('must have key')
      }
      if (!value) {
        throw new GqlInputError('must have value')
      }
      console.log('setVaultEntry', key, value)
      // const exists = await models.userVault.findUnique({ where: { key, userId: me.id } })
      const exists = await models.userVault.findFirst({ where: { key, userId: me.id } })
      if (exists) {
        await models.userVault.update({
          where: {
            userId_key: {
              userId: me.id,
              key
            }
          },
          data: { value }
        })
      } else {
        await models.userVault.create({
          data: { key, value, userId: me.id }
        })
      }
      return true
    },
    unsetVaultEntry: async (parent, { key }, { me, models }) => {
      if (!key) {
        throw new GqlInputError('must have key')
      }
      await models.userVault.deleteMany({
        where: {
          userId: me.id,
          key
        }
      })
      return true
    },
    clearVault: async (parent, args, { me, models }) => {
      await models.user.update({
        where: { id: me.id },
        data: { vaultKeyHash: '' }
      })
      await models.userVault.deleteMany({ where: { userId: me.id } })
      return true
    }
  }
}
