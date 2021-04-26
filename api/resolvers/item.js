import { UserInputError, AuthenticationError } from 'apollo-server-micro'

export default {
  Query: {
    items: async (parent, args, { models }) => {
      return await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE "parentId" IS NULL`)
    },
    recent: async (parent, args, { models }) => {
      return await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE "parentId" IS NULL
        ORDER BY created_at`)
    },
    item: async (parent, { id }, { models }) => {
      return (await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE id = ${id}`))[0]
    },
    userItems: async (parent, { userId }, { models }) => {
      return await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE "userId" = ${userId} AND "parentId" IS NULL
        ORDER BY created_at`)
    },
    comments: async (parent, { parentId }, { models }) => {
      const flat = await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE path <@ (SELECT path FROM "Item" where id = ${parentId}) AND id != ${parentId}
        ORDER BY "path"`)
      return nestComments(flat, parentId)[0]
    },
    userComments: async (parent, { userId }, { models }) => {
      return await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE "userId" = ${userId} AND "parentId" IS NOT NULL
        ORDER BY created_at DESC`)
    },
    root: async (parent, { id }, { models }) => {
      return (await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE id = (
          SELECT ltree2text(subltree(path, 0, 1))::integer
          FROM "Item"
          WHERE id = ${id})`))[0]
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
    },
    vote: async (parent, { id, sats = 1 }, { me, models }) => {
      // need to make sure we are logged in
      if (!me) {
        throw new AuthenticationError('You must be logged in')
      }

      const data = {
        sats,
        item: {
          connect: {
            id: parseInt(id)
          }
        },
        user: {
          connect: {
            name: me.name
          }
        }
      }

      await models.vote.create({ data })
      return sats
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
    sats: async (item, args, { models }) => {
      const { sum: { sats } } = await models.vote.aggregate({
        sum: {
          sats: true
        },
        where: {
          itemId: item.id
        }
      })

      return sats
    },
    meSats: async (item, args, { me, models }) => {
      if (!me) return 0

      const { sum: { sats } } = await models.vote.aggregate({
        sum: {
          sats: true
        },
        where: {
          itemId: item.id,
          userId: me.id
        }
      })

      return sats
    }
  }
}

const createItem = async (parent, { title, text, url, parentId }, { me, models }) => {
  if (!me) {
    throw new AuthenticationError('You must be logged in')
  }

  const data = {
    title,
    url,
    text,
    item: {
      connect: {

      }
    },
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

  const item = await models.item.create({ data })
  item.comments = []
  return item
}

function nestComments (flat, parentId) {
  const result = []
  let added = 0
  for (let i = 0; i < flat.length;) {
    if (!flat[i].comments) flat[i].comments = []
    if (Number(flat[i].parentId) === Number(parentId)) {
      result.push(flat[i])
      added++
      i++
    } else if (result.length > 0) {
      const item = result[result.length - 1]
      const [nested, newAdded] = nestComments(flat.slice(i), item.id)
      if (newAdded === 0) {
        break
      }
      item.comments.push(...nested)
      i += newAdded
      added += newAdded
    } else {
      break
    }
  }
  return [result, added]
}

// we have to do our own query because ltree is unsupported
const SELECT =
  `SELECT id, created_at as "createdAt", updated_at as "updatedAt", title,
    text, url, "userId", "parentId", ltree2text("path") AS "path"`
