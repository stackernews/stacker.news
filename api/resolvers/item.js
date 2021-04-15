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
        SELECT id, "created_at" as "createdAt", title, url, text,
          "userId", nlevel(path)-1 AS depth, ltree2text("path") AS "path"
        FROM "Item"
        WHERE "parentId" IS NULL`)
    },
    item: async (parent, { id }, { models }) => {
      const res = await models.$queryRaw(`
        SELECT id, "created_at" as "createdAt", title, url, text,
          "parentId", "userId", nlevel(path)-1 AS depth, ltree2text("path") AS "path"
        FROM "Item"
        WHERE id = ${id}`)
      return res.length ? res[0] : null
    },
    comments: async (parent, { parentId }, { models }) => {
      return await models.$queryRaw(`
        SELECT id, "created_at" as "createdAt", text, "parentId",
          "userId", nlevel(path)-1 AS depth, ltree2text("path") AS "path"
        FROM "Item"
        WHERE path <@ (SELECT path FROM "Item" where id = ${parentId}) AND id != ${parentId}
        ORDER BY "path"`)
    },
    root: async (parent, { id }, { models }) => {
      const res = await models.$queryRaw(`
        SELECT id, title
        FROM "Item"
        WHERE id = (SELECT ltree2text(subltree(path, 0, 1))::integer FROM "Item" WHERE id = ${id})`)
      return res.length ? res[0] : null
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
    ncomments: async (item, args, { models }) => {
      const [{ count }] = await models.$queryRaw`
        SELECT count(*)
        FROM "Item"
        WHERE path <@ text2ltree(${item.path}) AND id != ${item.id}`
      return count
    },
    sats: () => 0
  }
}
