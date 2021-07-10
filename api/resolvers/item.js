import { UserInputError, AuthenticationError } from 'apollo-server-micro'
import { ensureProtocol } from '../../lib/url'
import serialize from './serial'

const LIMIT = 21

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

function decodeCursor (cursor) {
  if (!cursor) {
    return { offset: 0, time: new Date() }
  } else {
    const res = JSON.parse(Buffer.from(cursor, 'base64'))
    res.time = new Date(res.time)
    return res
  }
}

function nextCursorEncoded (cursor) {
  cursor.offset += LIMIT
  return Buffer.from(JSON.stringify(cursor)).toString('base64')
}

export default {
  Query: {
    moreItems: async (parent, { sort, cursor, userId }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      let items
      switch (sort) {
        case 'user':
          items = await models.$queryRaw(`
            ${SELECT}
            FROM "Item"
            WHERE "userId" = $1 AND "parentId" IS NULL AND created_at <= $2
            ORDER BY created_at DESC
            OFFSET $3
            LIMIT ${LIMIT}`, Number(userId), decodedCursor.time, decodedCursor.offset)
          break
        case 'hot':
          items = await models.$queryRaw(`
            ${SELECT}
            FROM "Item"
            ${timedLeftJoinSats(1)}
            WHERE "parentId" IS NULL AND created_at <= $1
            ${timedOrderBySats(1)}
            OFFSET $2
            LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
          break
        default:
          items = await models.$queryRaw(`
            ${SELECT}
            FROM "Item"
            WHERE "parentId" IS NULL AND created_at <= $1
            ORDER BY created_at DESC
            OFFSET $2
            LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
          break
      }
      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    },
    moreFlatComments: async (parent, { cursor, userId }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      let comments
      if (userId) {
        comments = await models.$queryRaw(`
          ${SELECT}
          FROM "Item"
          WHERE "userId" = $1 AND "parentId" IS NOT NULL
          AND created_at <= $2
          ORDER BY created_at DESC
          OFFSET $3
          LIMIT ${LIMIT}`, Number(userId), decodedCursor.time, decodedCursor.offset)
      } else {
        if (!me) {
          throw new AuthenticationError('you must be logged in')
        }
        comments = await models.$queryRaw(`
          ${SELECT}
          From "Item"
          JOIN "Item" p ON "Item"."parentId" = p.id AND p."userId" = $1
          AND "Item"."userId" <> $1 AND "Item".created_at <= $2
          ORDER BY "Item".created_at DESC
          OFFSET $3
          LIMIT ${LIMIT}`, me.id, decodedCursor.time, decodedCursor.offset)
      }
      return {
        cursor: comments.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        comments
      }
    },
    notifications: async (parent, args, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      return await models.$queryRaw(`
        ${SELECT}
        From "Item"
        JOIN "Item" p ON "Item"."parentId" = p.id AND p."userId" = $1
        AND "Item"."userId" <> $1
        ORDER BY "Item".created_at DESC`, me.id)
    },
    item: async (parent, { id }, { models }) => {
      const [item] = await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE id = $1`, Number(id))
      item.comments = comments(models, id)
      return item
    },
    userComments: async (parent, { userId }, { models }) => {
      return await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE "userId" = $1 AND "parentId" IS NOT NULL
        ORDER BY created_at DESC`, Number(userId))
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

      const { sum: { sats } } = await models.vote.aggregate({
        sum: {
          sats: true
        },
        where: {
          itemId: item.id,
          userId: me.id
        }
      })

      return sats || 0
    },
    root: async (item, args, { models }) => {
      if (!item.parentId) {
        return null
      }
      return (await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE id = (
          SELECT ltree2text(subltree(path, 0, 1))::integer
          FROM "Item"
          WHERE id = $1)`, Number(item.id)))[0]
    },
    parent: async (item, args, { models }) => {
      if (!item.parentId) {
        return null
      }
      return await models.item.findUnique({ where: { id: item.parentId } })
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

const LEFT_JOIN_SATS_SELECT = 'SELECT i.id, SUM(CASE WHEN "Vote".boost THEN 0 ELSE "Vote".sats END) as sats,  SUM(CASE WHEN "Vote".boost THEN "Vote".sats ELSE 0 END) as boost'

function timedLeftJoinSats (num) {
  return `LEFT JOIN (${LEFT_JOIN_SATS_SELECT}
  FROM "Item" i
  JOIN "Vote" ON i.id = "Vote"."itemId" AND "Vote".created_at <= $${num}
  GROUP BY i.id) x ON "Item".id = x.id`
}

const LEFT_JOIN_SATS =
  `LEFT JOIN (${LEFT_JOIN_SATS_SELECT}
  FROM "Item" i
  JOIN "Vote" ON i.id = "Vote"."itemId"
  GROUP BY i.id) x ON "Item".id = x.id`

function timedOrderBySats (num) {
  return `ORDER BY ((x.sats-1)/POWER(EXTRACT(EPOCH FROM ($${num} - "Item".created_at))/3600+2, 1.5) +
    (x.boost)/POWER(EXTRACT(EPOCH FROM ($${num} - "Item".created_at))/3600+2, 5)) DESC NULLS LAST`
}

const ORDER_BY_SATS =
  `ORDER BY ((x.sats-1)/POWER(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - "Item".created_at))/3600+2, 1.5) +
    (x.boost)/POWER(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - "Item".created_at))/3600+2, 5)) DESC NULLS LAST`
