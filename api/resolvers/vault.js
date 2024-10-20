import { E_VAULT_KEY_EXISTS, GqlAuthenticationError, GqlInputError } from '@/lib/error'

export default {
  VaultOwner: {
    __resolveType: (obj) => obj.type
  },
  Query: {
    getVaultEntry: async (parent, { ownerId, ownerType, key }, { me, models }, info) => {
      if (!me) throw new GqlAuthenticationError()
      if (!key) throw new GqlInputError('must have key')
      checkOwner(info, ownerType)

      const k = await models.vault.findUnique({
        where: {
          userId_key_ownerId_ownerType: {
            key,
            userId: me.id,
            ownerId: Number(ownerId),
            ownerType
          }
        }
      })
      return k
    },
    getVaultEntries: async (parent, { ownerId, ownerType, keysFilter }, { me, models }, info) => {
      if (!me) throw new GqlAuthenticationError()
      checkOwner(info, ownerType)

      const entries = await models.vault.findMany({
        where: {
          userId: me.id,
          ownerId: Number(ownerId),
          ownerType,
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
    setVaultEntry: async (parent, { ownerId, ownerType, key, value, skipIfSet }, { me, models }, info) => {
      if (!me) throw new GqlAuthenticationError()
      if (!key) throw new GqlInputError('must have key')
      if (!value) throw new GqlInputError('must have value')
      checkOwner(info, ownerType)

      if (skipIfSet) {
        const existing = await models.vault.findUnique({
          where: {
            userId_key_ownerId_ownerType: {
              userId: me.id,
              key,
              ownerId: Number(ownerId),
              ownerType
            }
          }
        })
        if (existing) {
          return false
        }
      }
      await models.vault.upsert({
        where: {
          userId_key_ownerId_ownerType: {
            userId: me.id,
            key,
            ownerId: Number(ownerId),
            ownerType
          }
        },
        update: {
          value
        },
        create: {
          key,
          value,
          userId: me.id,
          ownerId: Number(ownerId),
          ownerType
        }
      })
      return true
    },
    unsetVaultEntry: async (parent, { ownerId, ownerType, key }, { me, models }, info) => {
      if (!me) throw new GqlAuthenticationError()
      if (!key) throw new GqlInputError('must have key')
      checkOwner(info, ownerType)

      await models.vault.deleteMany({
        where: {
          userId: me.id,
          key,
          ownerId: Number(ownerId),
          ownerType
        }
      })
      return true
    },
    clearVault: async (parent, args, { me, models }) => {
      if (!me) throw new GqlAuthenticationError()

      await models.user.update({
        where: { id: me.id },
        data: { vaultKeyHash: '' }
      })
      await models.vault.deleteMany({ where: { userId: me.id } })
      return true
    },
    setVaultKeyHash: async (parent, { hash }, { me, models }) => {
      if (!me) throw new GqlAuthenticationError()
      if (!hash) throw new GqlInputError('hash required')

      const { vaultKeyHash: oldKeyHash } = await models.user.findUnique({ where: { id: me.id } })
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
    }
  }
}

/**
 * Ensures the passed ownerType represent a valid type that extends VaultOwner in the graphql schema.
 * Throws a GqlInputError otherwise
 * @param {*} info the graphql resolve info
 * @param {string} ownerType the ownerType to check
 * @throws GqlInputError
 */
function checkOwner (info, ownerType) {
  const gqltypeDef = info.schema.getType(ownerType)
  const ownerInterfaces = gqltypeDef?.getInterfaces?.()
  if (!ownerInterfaces?.some((iface) => iface.name === 'VaultOwner')) {
    throw new GqlInputError('owner must implement VaultOwner interface but ' + ownerType + ' does not')
  }
}
