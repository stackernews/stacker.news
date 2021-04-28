import { UserInputError, AuthenticationError } from 'apollo-server-micro'

export default {
  Query: {
    items: async (parent, args, { models }) => {
      return await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        ${LEFT_JOIN_SATS}
        WHERE "parentId" IS NULL
        ${ORDER_BY_SATS}`)
    },
    recent: async (parent, args, { models }) => {
      return await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE "parentId" IS NULL
        ORDER BY created_at DESC`)
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

      if (sats <= 0) {
        throw new UserInputError('Sats must be positive', { argumentName: 'sats' })
      }

      // check if we've already voted for the item
      const boosted = await models.vote.findFirst({
        where: {
          itemId: parseInt(id),
          userId: me.id
        }
      })

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
        },
        boost: !!boosted
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
    comments: async (item, args, { models }) => {
      const flat = await models.$queryRaw(`
        WITH RECURSIVE base AS (
          ${SELECT}, ARRAY[row_number() OVER (${ORDER_BY_SATS}, "Item".path)] AS sort_path
          FROM "Item"
          ${LEFT_JOIN_SATS}
          WHERE "parentId" = ${item.id}
        UNION ALL
          ${SELECT}, p.sort_path || row_number() OVER (${ORDER_BY_SATS}, "Item".path)
          FROM base p
          JOIN "Item" ON ltree2text(subpath("Item"."path", 0, -1)) = p."path"
          ${LEFT_JOIN_SATS})
        SELECT * FROM base ORDER BY sort_path`)
      const comments = nestComments(flat, item.id)[0]
      return comments
    },
    sats: async (item, args, { models }) => {
      const { sum: { sats } } = await models.vote.aggregate({
        sum: {
          sats: true
        },
        where: {
          itemId: item.id,
          boost: false
        }
      })

      return sats
    },
    boost: async (item, args, { models }) => {
      const { sum: { sats } } = await models.vote.aggregate({
        sum: {
          sats: true
        },
        where: {
          itemId: item.id,
          boost: true
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
  `SELECT "Item".id, "Item".created_at as "createdAt", "Item".updated_at as "updatedAt", "Item".title,
  "Item".text, "Item".url, "Item"."userId", "Item"."parentId", ltree2text("Item"."path") AS "path"`

const LEFT_JOIN_SATS =
  `LEFT JOIN (SELECT i.id, SUM("Vote".sats) as sats
  FROM "Item" i
  JOIN "Vote" ON i.id = "Vote"."itemId"
  GROUP BY i.id) x ON "Item".id = x.id`

const ORDER_BY_SATS =
  'ORDER BY (x.sats-1)/POWER(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE \'UTC\') - "Item".created_at))/3600+2, 1.5) DESC NULLS LAST'
