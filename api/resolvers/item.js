import { UserInputError, AuthenticationError } from 'apollo-server-micro'

const createItem = async (parent, { title, text, url, parentId }, { me, models }) => {
  if (!me) {
    throw new AuthenticationError('You must be logged in')
  }

  const data = {
    title,
    url,
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

export default {
  Query: {
    items: async (parent, args, { models }) => {
      return await models.$queryRaw(`
        SELECT id, "created_at" as "createdAt", title, url, text, "userId", ltree2text("path") AS "path"
        FROM "Item"
        WHERE "parentId" IS NULL
        ORDER BY "path"`)
    },
    item: async (parent, { id }, { models }) => {
      const res = await models.$queryRaw(`
        SELECT id, "created_at" as "createdAt", title, url, text, "parentId", "userId", ltree2text("path") AS "path"
        FROM "Item"
        WHERE id = ${id}
        ORDER BY "path"`)
      return res.length ? res[0] : null
    },
    ncomments: async (parent, { parentId }, { models }) => {
      return await models.$queryRaw(`
        SELECT id, "created_at" as "createdAt", title, url, text, "userId", ltree2text("path") AS "path"
        FROM "Item"
        ORDER BY "path"`)
    }
  },

  Mutation: {
    createLink: async (parent, { title, url }, { me, models }) => {
      if (!title) {
        throw new UserInputError('Link must have title', { argumentName: 'title' })
      }

      if (!url) {
        throw new UserInputError('Link must have url', { argumentName: 'url' })
      }

      return await createItem(parent, { title, url }, { me, models })
    },
    createDiscussion: async (parent, { title, text }, { me, models }) => {
      if (!title) {
        throw new UserInputError('Link must have title', { argumentName: 'title' })
      }

      return await createItem(parent, { title, text }, { me, models })
    },
    createComment: async (parent, { text, parentId }, { me, models }) => {
      if (!text) {
        throw new UserInputError('Comment must have text', { argumentName: 'text' })
      }

      if (!parentId) {
        throw new UserInputError('Comment must have parent', { argumentName: 'text' })
      }

      return await createItem(parent, { text, parentId }, { me, models })
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
    },
    ncomments: async (item, args, { models }) => {
      const [{ count }] = await models.$queryRaw`
        SELECT count(*)
        FROM "Item"
        WHERE path <@ text2ltree(${item.id}) AND id != ${item.id}`
      return count
    },
    sats: () => 0
  }
}
