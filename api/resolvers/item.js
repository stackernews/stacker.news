import { UserInputError, AuthenticationError } from 'apollo-server-micro'
import { ensureProtocol } from '../../lib/url'
import serialize from './serial'
import { decodeCursor, LIMIT, nextCursorEncoded } from '../../lib/cursor'
import { getMetadata, metadataRuleSets } from 'page-metadata-parser'
import domino from 'domino'

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

export async function getItem (parent, { id }, { models }) {
  const [item] = await models.$queryRaw(`
  ${SELECT}
  FROM "Item"
  WHERE id = $1`, Number(id))
  if (item) {
    item.comments = comments(models, id)
  }
  return item
}

export default {
  Query: {
    moreItems: async (parent, { sort, cursor, name, within }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      let items; let user; let interval = 'INTERVAL '

      switch (sort) {
        case 'user':
          if (!name) {
            throw new UserInputError('must supply name', { argumentName: 'name' })
          }

          user = await models.user.findUnique({ where: { name } })
          if (!user) {
            throw new UserInputError('no user has that name', { argumentName: 'name' })
          }

          items = await models.$queryRaw(`
            ${SELECT}
            FROM "Item"
            WHERE "userId" = $1 AND "parentId" IS NULL AND created_at <= $2
            ORDER BY created_at DESC
            OFFSET $3
            LIMIT ${LIMIT}`, user.id, decodedCursor.time, decodedCursor.offset)
          break
        case 'hot':
          // HACK we can speed hack the first hot page, by limiting our query to only
          // the most recently created items so that the tables doesn't have to
          // fully be computed
          // if the offset is 0, we limit our search to posts from the last week
          // if there are 21 items, return them ... if not do the unrestricted query
          // instead of doing this we should materialize a view ... but this is easier for now

          if (decodedCursor.offset === 0) {
            items = await models.$queryRaw(`
            ${SELECT}
            FROM "Item"
            ${timedLeftJoinSats(1)}
            WHERE "parentId" IS NULL AND created_at <= $1 AND created_at > $3
            ${timedOrderBySats(1)}
            OFFSET $2
            LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset, new Date(new Date() - 7))
          }

          if (decodedCursor.offset !== 0 || items?.length < LIMIT) {
            items = await models.$queryRaw(`
            ${SELECT}
            FROM "Item"
            ${timedLeftJoinSats(1)}
            WHERE "parentId" IS NULL AND created_at <= $1
            ${timedOrderBySats(1)}
            OFFSET $2
            LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
          }
          break
        case 'top':
          switch (within?.pop()) {
            case 'day':
              interval += "'1 day'"
              break
            case 'week':
              interval += "'7 days'"
              break
            case 'month':
              interval += "'1 month'"
              break
            case 'year':
              interval += "'1 year'"
              break
          }

          items = await models.$queryRaw(`
          ${SELECT}
          FROM "Item"
          ${timedLeftJoinSats(1)}
          WHERE "parentId" IS NULL AND created_at <= $1
          ${within ? ` AND created_at >= $1 - ${interval}` : ''}
          ORDER BY x.sats DESC NULLS LAST, created_at DESC
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
    moreFlatComments: async (parent, { cursor, name }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)

      if (!name) {
        throw new UserInputError('must supply name', { argumentName: 'name' })
      }

      const user = await models.user.findUnique({ where: { name } })
      if (!user) {
        throw new UserInputError('no user has that name', { argumentName: 'name' })
      }

      const comments = await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE "userId" = $1 AND "parentId" IS NOT NULL
        AND created_at <= $2
        ORDER BY created_at DESC
        OFFSET $3
        LIMIT ${LIMIT}`, user.id, decodedCursor.time, decodedCursor.offset)

      return {
        cursor: comments.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        comments
      }
    },
    item: getItem,
    pageTitle: async (parent, { url }, { models }) => {
      try {
        const response = await fetch(ensureProtocol(url), { redirect: 'follow' })
        const html = await response.text()
        const doc = domino.createWindow(html).document
        const metadata = getMetadata(doc, url, { title: metadataRuleSets.title })
        return metadata?.title
      } catch (e) {
        return null
      }
    },
    dupes: async (parent, { url }, { models }) => {
      const urlObj = new URL(ensureProtocol(url))
      return await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE url LIKE ($1 || '?%') OR url = $1
        ORDER BY created_at DESC
        LIMIT 3`, urlObj.origin + urlObj.pathname)
    }
  },

  Mutation: {
    createLink: async (parent, { title, url, boost }, { me, models }) => {
      if (!title) {
        throw new UserInputError('link must have title', { argumentName: 'title' })
      }

      if (!url) {
        throw new UserInputError('link must have url', { argumentName: 'url' })
      }

      return await createItem(parent, { title, url: ensureProtocol(url), boost }, { me, models })
    },
    updateLink: async (parent, { id, title, url }, { me, models }) => {
      if (!id) {
        throw new UserInputError('link must have id', { argumentName: 'id' })
      }

      if (!title) {
        throw new UserInputError('link must have title', { argumentName: 'title' })
      }

      if (!url) {
        throw new UserInputError('link must have url', { argumentName: 'url' })
      }

      // update iff this item belongs to me
      const item = await models.item.findUnique({ where: { id: Number(id) } })
      if (Number(item.userId) !== Number(me.id)) {
        throw new AuthenticationError('item does not belong to you')
      }

      if (Date.now() > new Date(item.createdAt).getTime() + 10 * 60000) {
        throw new UserInputError('item can no longer be editted')
      }

      return await updateItem(parent, { id, data: { title, url: ensureProtocol(url) } }, { me, models })
    },
    createDiscussion: async (parent, { title, text, boost }, { me, models }) => {
      if (!title) {
        throw new UserInputError('discussion must have title', { argumentName: 'title' })
      }

      return await createItem(parent, { title, text, boost }, { me, models })
    },
    updateDiscussion: async (parent, { id, title, text }, { me, models }) => {
      if (!id) {
        throw new UserInputError('discussion must have id', { argumentName: 'id' })
      }

      if (!title) {
        throw new UserInputError('discussion must have title', { argumentName: 'title' })
      }

      // update iff this item belongs to me
      const item = await models.item.findUnique({ where: { id: Number(id) } })
      if (Number(item.userId) !== Number(me.id)) {
        throw new AuthenticationError('item does not belong to you')
      }

      if (Date.now() > new Date(item.createdAt).getTime() + 10 * 60000) {
        throw new UserInputError('item can no longer be editted')
      }

      return await updateItem(parent, { id, data: { title, text } }, { me, models })
    },
    createComment: async (parent, { text, parentId }, { me, models }) => {
      if (!text) {
        throw new UserInputError('comment must have text', { argumentName: 'text' })
      }

      if (!parentId) {
        throw new UserInputError('comment must have parent', { argumentName: 'parentId' })
      }

      return await createItem(parent, { text, parentId }, { me, models })
    },
    updateComment: async (parent, { id, text }, { me, models }) => {
      if (!text) {
        throw new UserInputError('comment must have text', { argumentName: 'text' })
      }

      if (!id) {
        throw new UserInputError('comment must have id', { argumentName: 'id' })
      }

      // update iff this comment belongs to me
      const comment = await models.item.findUnique({ where: { id: Number(id) } })
      if (Number(comment.userId) !== Number(me.id)) {
        throw new AuthenticationError('comment does not belong to you')
      }

      if (Date.now() > new Date(comment.createdAt).getTime() + 10 * 60000) {
        throw new UserInputError('comment can no longer be editted')
      }

      return await updateItem(parent, { id, data: { text } }, { me, models })
    },
    act: async (parent, { id, act, sats, tipDefault }, { me, models }) => {
      // need to make sure we are logged in
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      if (sats <= 0) {
        throw new UserInputError('sats must be positive', { argumentName: 'sats' })
      }

      // if we are tipping disallow self tips
      if (act === 'TIP') {
        const [item] = await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE id = $1 AND "userId" = $2`, Number(id), me.id)
        if (item) {
          throw new UserInputError('cannot tip your self')
        }
        // if tipDefault, set on user
        if (tipDefault) {
          await models.user.update({ where: { id: me.id }, data: { tipDefault: sats } })
        }
      }

      await serialize(models, models.$queryRaw`SELECT item_act(${Number(id)}, ${me.id}, ${act}, ${Number(sats)})`)

      return {
        sats,
        act
      }
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
      const { sum: { sats } } = await models.itemAct.aggregate({
        sum: {
          sats: true
        },
        where: {
          itemId: item.id,
          act: 'VOTE'
        }
      })

      return sats || 0
    },
    boost: async (item, args, { models }) => {
      const { sum: { sats } } = await models.itemAct.aggregate({
        sum: {
          sats: true
        },
        where: {
          itemId: item.id,
          act: 'BOOST'
        }
      })

      return sats || 0
    },
    tips: async (item, args, { models }) => {
      const { sum: { sats } } = await models.itemAct.aggregate({
        sum: {
          sats: true
        },
        where: {
          itemId: item.id,
          act: 'TIP'
        }
      })

      return sats || 0
    },
    meVote: async (item, args, { me, models }) => {
      if (!me) return 0

      const { sum: { sats } } = await models.itemAct.aggregate({
        sum: {
          sats: true
        },
        where: {
          itemId: item.id,
          userId: me.id,
          act: 'VOTE'
        }
      })

      return sats || 0
    },
    meBoost: async (item, args, { me, models }) => {
      if (!me) return 0

      const { sum: { sats } } = await models.itemAct.aggregate({
        sum: {
          sats: true
        },
        where: {
          itemId: item.id,
          userId: me.id,
          act: 'BOOST'
        }
      })

      return sats || 0
    },
    meTip: async (item, args, { me, models }) => {
      if (!me) return 0

      const { sum: { sats } } = await models.itemAct.aggregate({
        sum: {
          sats: true
        },
        where: {
          itemId: item.id,
          userId: me.id,
          act: 'TIP'
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

const namePattern = /\B@[\w_]+/gi

export const createMentions = async (item, models) => {
  // if we miss a mention, in the rare circumstance there's some kind of
  // failure, it's not a big deal so we don't do it transactionally
  // ideally, we probably would
  if (!item.text) {
    return
  }

  try {
    const mentions = item.text.match(namePattern)?.map(m => m.slice(1))
    if (mentions?.length > 0) {
      const users = await models.user.findMany({
        where: {
          name: { in: mentions }
        }
      })

      users.forEach(async user => {
        const data = {
          itemId: item.id,
          userId: user.id
        }

        await models.mention.upsert({
          where: {
            itemId_userId: data
          },
          update: data,
          create: data
        })
      })
    }
  } catch (e) {
    console.log('mention failure', e)
  }
}

const updateItem = async (parent, { id, data }, { me, models }) => {
  const item = await models.item.update({
    where: { id: Number(id) },
    data
  })

  await createMentions(item, models)

  return item
}

const createItem = async (parent, { title, url, text, boost, parentId }, { me, models }) => {
  if (!me) {
    throw new AuthenticationError('you must be logged in')
  }

  if (boost && boost < 0) {
    throw new UserInputError('boost must be positive', { argumentName: 'boost' })
  }

  const [item] = await serialize(models,
    models.$queryRaw(`${SELECT} FROM create_item($1, $2, $3, $4, $5, $6) AS "Item"`,
      title, url, text, Number(boost || 0), Number(parentId), Number(me.id)))

  await createMentions(item, models)

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
export const SELECT =
  `SELECT "Item".id, "Item".created_at as "createdAt", "Item".updated_at as "updatedAt", "Item".title,
  "Item".text, "Item".url, "Item"."userId", "Item"."parentId", ltree2text("Item"."path") AS "path"`

const LEFT_JOIN_SATS_SELECT = 'SELECT i.id, SUM(CASE WHEN "ItemAct".act = \'VOTE\' THEN "ItemAct".sats ELSE 0 END) as sats,  SUM(CASE WHEN "ItemAct".act = \'BOOST\' THEN "ItemAct".sats ELSE 0 END) as boost'

function timedLeftJoinSats (num) {
  return `LEFT JOIN (${LEFT_JOIN_SATS_SELECT}
  FROM "Item" i
  JOIN "ItemAct" ON i.id = "ItemAct"."itemId" AND "ItemAct".created_at <= $${num}
  GROUP BY i.id) x ON "Item".id = x.id`
}

const LEFT_JOIN_SATS =
  `LEFT JOIN (${LEFT_JOIN_SATS_SELECT}
  FROM "Item" i
  JOIN "ItemAct" ON i.id = "ItemAct"."itemId"
  GROUP BY i.id) x ON "Item".id = x.id`

/* NOTE: because many items will have the same rank, we need to tie break with a unique field so pagination works */
function timedOrderBySats (num) {
  return `ORDER BY ((x.sats-1)/POWER(EXTRACT(EPOCH FROM ($${num} - "Item".created_at))/3600+2, 1.5) +
    (x.boost)/POWER(EXTRACT(EPOCH FROM ($${num} - "Item".created_at))/3600+2, 5)) DESC NULLS LAST, "Item".id DESC`
}

const ORDER_BY_SATS =
  `ORDER BY ((x.sats-1)/POWER(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - "Item".created_at))/3600+2, 1.5) +
    (x.boost)/POWER(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - "Item".created_at))/3600+2, 5)) DESC NULLS LAST, "Item".id DESC`
