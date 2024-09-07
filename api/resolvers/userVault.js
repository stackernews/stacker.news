import { GraphQLError } from 'graphql'

export default {
  Query: {
    getVaultEntry: async (parent, { key }, { me, models }) => {
      if (!key) {
        throw new GraphQLError('Must have key', { extensions: { code: 'BAD_INPUT' } })
      }
      // return await models.userVault.findUnique({ where: { key, userId: me.id } })
      const k = await models.userVault.findFirst({ where: { key, userId: me.id } })
      return k
    }
  },

  Mutation: {
    setVaultKeyHash: async (parent, { hash }, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }
      if (!hash) {
        throw new GraphQLError('hash cannot be empty or null', { extensions: { code: 'BAD_INPUT' } })
      }
      const oldKeyHash = await models.user.findUnique({ where: { id: me.id } }).then(u => u.vaultKeyHash)
      if (oldKeyHash) {
        if (oldKeyHash !== hash) {
          throw new GraphQLError('vault key already set', { extensions: { code: 'VAULT_KEY_ALREADY_SET' } })
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
        throw new GraphQLError('Must have key', { extensions: { code: 'BAD_INPUT' } })
      }
      if (!value) {
        throw new GraphQLError('Must have value', { extensions: { code: 'BAD_INPUT' } })
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
        throw new GraphQLError('Must have key', { extensions: { code: 'BAD_INPUT' } })
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
