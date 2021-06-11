import { UserInputError, AuthenticationError } from 'apollo-server-micro'
import { ensureProtocol } from '../../lib/url'
import serialize from './serial'

async function comments (models, id) {
  const flat = await models.$queryRaw(`
        WITH RECURSIVE base AS (
          ${SELECT}, ARRAY[row_number() OVER (${ORDER_BY_SATS}, "Item".path)] AS sort_path
          FROM "Item"
          ${LEFT_JOIN_SATS}
          WHERE "parentId" = $1
        UNION ALL
          ${SELECT}, p.sort_path || row_number() OVER (${ORDER_BY_SATS}, "Item".path)
          FROM base p
          JOIN "Item" ON ltree2text(subpath("Item"."path", 0, -1)) = p."path"
          ${LEFT_JOIN_SATS})
        SELECT * FROM base ORDER BY sort_path`, Number(id))
  return nestComments(flat, id)[0]
}

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
      const [item] = await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE id = $1`, Number(id))
      item.comments = comments(models, id)
      return item
    },
    userItems: async (parent, { userId }, { models }) => {
      return await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE "userId" = $1 AND "parentId" IS NULL
        ORDER BY created_at`, Number(userId))
    },
    userComments: async (parent, { userId }, { models }) => {
      return await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE "userId" = $1 AND "parentId" IS NOT NULL
        ORDER BY created_at DESC`, Number(userId))
    },
    root: async (parent, { id }, { models }) => {
      return (await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE id = (
          SELECT ltree2text(subltree(path, 0, 1))::integer
          FROM "Item"
          WHERE id = $1)`, Number(id)))[0]
    }
  },

  Mutation: {
    createLink: async (parent, { title, url }, { me, models }) => {
      if (!title) {
        throw new UserInputError('link must have title', { argumentName: 'title' })
      }

      if (!url) {
        throw new UserInputError('link must have url', { argumentName: 'url' })
      }

      console.log(ensureProtocol(url))

      return await createItem(parent, { title, url: ensureProtocol(url) }, { me, models })
    },
    createDiscussion: async (parent, { title, text }, { me, models }) => {
      if (!title) {
        throw new UserInputError('link must have title', { argumentName: 'title' })
      }

      return await createItem(parent, { title, text }, { me, models })
    },
    createComment: async (parent, { text, parentId }, { me, models }) => {
      if (!text) {
        throw new UserInputError('comment must have text', { argumentName: 'text' })
      }

      if (!parentId) {
        throw new UserInputError('comment must have parent', { argumentName: 'text' })
      }

      return await createItem(parent, { text, parentId }, { me, models })
    },
    vote: async (parent, { id, sats = 1 }, { me, models }) => {
      // need to make sure we are logged in
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      if (sats <= 0) {
        throw new UserInputError('sats must be positive', { argumentName: 'sats' })
      }

      await serialize(models, models.$queryRaw`SELECT vote(${Number(id)}, ${me.name}, ${Number(sats)})`)
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
      return count || 0
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

      return sats || 0
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

      return sats || 0
    },
    meSats: async (item, args, { me, models }) => {
      if (!me) return 0

      const meFull = await models.user.findUnique({ where: { name: me.name } })

      const { sum: { sats } } = await models.vote.aggregate({
        sum: {
          sats: true
        },
        where: {
          itemId: item.id,
          userId: meFull.id
        }
      })

      return sats || 0
    }
  }
}

const createItem = async (parent, { title, url, text, parentId }, { me, models }) => {
  if (!me) {
    throw new AuthenticationError('you must be logged in')
  }

  const [item] = await serialize(models, models.$queryRaw(
    `${SELECT} FROM create_item($1, $2, $3, $4, $5) AS "Item"`,
    title, url, text, Number(parentId), me.name))
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
