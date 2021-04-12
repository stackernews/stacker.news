import { UserInputError, AuthenticationError } from 'apollo-server-micro'

export default {
  Query: {
    items: async (parent, args, { models }) => {
      return await models.$queryRaw(`
        SELECT id, text, "userId", ltree2text("path") AS "path"
        FROM "Item"
        ORDER BY "path"`)
    }
  },

  Mutation: {
    createItem: async (parent, { text, parentId }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('You must be logged in')
      }

      if (!text) {
        throw new UserInputError('Item must have text', { argumentName: 'text' })
      }

      const data = {
        text,
        user: {
          connect: {
            name: me.name
          }
        }
      }

      if (parentId) {
        data.parent = {
          connect: {
            id: parseInt(parentId)
          }
        }
      }

      return await models.item.create({ data })
    }
  },

  Item: {
    user: async (item, args, { models }) =>
      await models.user.findUnique({ where: { id: item.userId } }),
    depth: async (item, args, { models }) => {
      if (item.path) {
        return item.path.split('.').length - 1
      }

      // as the result of a mutation, path is not populated
      const [{ path }] = await models.$queryRaw`
        SELECT ltree2text("path") AS "path"
        FROM "Item"
        WHERE id = ${item.id}`

      return path.split('.').length - 1
    }
  }
}
