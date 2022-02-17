import { UserInputError, AuthenticationError } from 'apollo-server-micro'
import { ensureProtocol } from '../../lib/url'
import serialize from './serial'
import { decodeCursor, LIMIT, nextCursorEncoded } from '../../lib/cursor'
import { getMetadata, metadataRuleSets } from 'page-metadata-parser'
import domino from 'domino'

async function comments (models, id, sort) {
  let orderBy
  let join
  switch (sort) {
    case 'top':
      orderBy = 'ORDER BY x.sats DESC NULLS LAST'
      join = LEFT_JOIN_WEIGHTED_SATS
      break
    case 'recent':
      orderBy = 'ORDER BY "Item".created_at DESC'
      join = ''
      break
    default:
      orderBy = ORDER_BY_SATS
      join = LEFT_JOIN_WEIGHTED_SATS
      break
  }

  const flat = await models.$queryRaw(`
        WITH RECURSIVE base AS (
          ${SELECT}, ARRAY[row_number() OVER (${orderBy}, "Item".path)] AS sort_path
          FROM "Item"
          ${join}
          WHERE "parentId" = $1
        UNION ALL
          ${SELECT}, p.sort_path || row_number() OVER (${orderBy}, "Item".path)
          FROM base p
          JOIN "Item" ON ltree2text(subpath("Item"."path", 0, -1)) = p."path"
          ${join})
        SELECT * FROM base ORDER BY sort_path`, Number(id))
  return nestComments(flat, id)[0]
}

export async function getItem (parent, { id }, { models }) {
  const [item] = await models.$queryRaw(`
  ${SELECT}
  FROM "Item"
  WHERE id = $1`, Number(id))
  if (item) {
    item.comments = comments(models, id, 'hot')
  }
  return item
}

function topClause (within) {
  let interval = ' AND created_at >= $1 - INTERVAL '
  switch (within) {
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
    default:
      interval = ''
      break
  }
  return interval
}

export default {
  Query: {
    items: async (parent, { sub, sort, cursor, name, within }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      let items; let user; let pins; let subFull

      const subClause = (num) => {
        return sub ? ` AND "subName" = $${num} ` : `AND ("subName" IS NULL OR "subName" = $${3}) `
      }

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
            AND "pinId" IS NULL
            ORDER BY created_at DESC
            OFFSET $3
            LIMIT ${LIMIT}`, user.id, decodedCursor.time, decodedCursor.offset)
          break
        case 'recent':
          items = await models.$queryRaw(`
            ${SELECT}
            FROM "Item"
            WHERE "parentId" IS NULL AND created_at <= $1 AND "pinId" IS NULL
            ${subClause(3)}
            ORDER BY created_at DESC
            OFFSET $2
            LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset, sub || 'NULL')
          break
        case 'top':
          items = await models.$queryRaw(`
            ${SELECT}
            FROM "Item"
            ${timedLeftJoinWeightedSats(1)}
            WHERE "parentId" IS NULL AND created_at <= $1
            AND "pinId" IS NULL
            ${topClause(within)}
            ORDER BY x.sats DESC NULLS LAST, created_at DESC
            OFFSET $2
            LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
          break
        default:
          // sub so we know the default ranking
          if (sub) {
            subFull = await models.sub.findUnique({ where: { name: sub } })
          }

          switch (subFull?.rankingType) {
            case 'AUCTION':
              // it might be sufficient to sort by the floor(maxBid / 1000) desc, created_at desc
              // we pull from their wallet
              // TODO: need to filter out by payment status
              items = await models.$queryRaw(`
                ${SELECT}
                FROM "Item"
                WHERE "parentId" IS NULL AND created_at <= $1
                AND "pinId" IS NULL
                ${subClause(3)}
                ORDER BY "maxBid" / 1000 DESC, created_at ASC
                OFFSET $2
                LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset, sub)
              break
            default:
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
                  ${timedLeftJoinWeightedSats(1)}
                  WHERE "parentId" IS NULL AND created_at <= $1 AND created_at > $3
                  AND "pinId" IS NULL
                  ${timedOrderBySats(1)}
                  OFFSET $2
                  LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset, new Date(new Date() - 7))
              }

              if (decodedCursor.offset !== 0 || items?.length < LIMIT) {
                items = await models.$queryRaw(`
                  ${SELECT}
                  FROM "Item"
                  ${timedLeftJoinWeightedSats(1)}
                  WHERE "parentId" IS NULL AND created_at <= $1
                  AND "pinId" IS NULL
                  ${timedOrderBySats(1)}
                  OFFSET $2
                  LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
              }

              if (decodedCursor.offset === 0) {
                // get pins for the page and return those separately
                pins = await models.$queryRaw(`SELECT rank_filter.*
                  FROM (
                    ${SELECT},
                    rank() OVER (
                        PARTITION BY "pinId"
                        ORDER BY created_at DESC
                    )
                    FROM "Item"
                    WHERE "pinId" IS NOT NULL
                ) rank_filter WHERE RANK = 1`)
              }
              break
          }
          break
      }
      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items,
        pins
      }
    },
    allItems: async (parent, { cursor }, { models }) => {
      const decodedCursor = decodeCursor(cursor)
      const items = await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        ORDER BY created_at DESC
        OFFSET $1
        LIMIT ${LIMIT}`, decodedCursor.offset)
      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    },
    moreFlatComments: async (parent, { cursor, name, sort, within }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)

      let comments, user
      switch (sort) {
        case 'user':
          if (!name) {
            throw new UserInputError('must supply name', { argumentName: 'name' })
          }

          user = await models.user.findUnique({ where: { name } })
          if (!user) {
            throw new UserInputError('no user has that name', { argumentName: 'name' })
          }

          comments = await models.$queryRaw(`
            ${SELECT}
            FROM "Item"
            WHERE "userId" = $1 AND "parentId" IS NOT NULL
            AND created_at <= $2
            ORDER BY created_at DESC
            OFFSET $3
            LIMIT ${LIMIT}`, user.id, decodedCursor.time, decodedCursor.offset)
          break
        case 'top':
          comments = await models.$queryRaw(`
          ${SELECT}
          FROM "Item"
          ${timedLeftJoinWeightedSats(1)}
          WHERE "parentId" IS NOT NULL
          AND created_at <= $1
          ${topClause(within)}
          ORDER BY x.sats DESC NULLS LAST, created_at DESC
          OFFSET $2
          LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
          break
        default:
          throw new UserInputError('invalid sort type', { argumentName: 'sort' })
      }

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
      let uri = urlObj.hostname + urlObj.pathname
      uri = uri.endsWith('/') ? uri.slice(0, -1) : uri
      let similar = `(http(s)?://)?${uri}/?`

      const whitelist = ['news.ycombinator.com/item', 'bitcointalk.org/index.php', 'www.youtube.com/watch']
      if (whitelist.includes(uri)) {
        similar += `\\${urlObj.search}`
      } else {
        similar += '(\\?%)?'
      }

      return await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE url SIMILAR TO $1
        ORDER BY created_at DESC
        LIMIT 3`, similar)
    },
    comments: async (parent, { id, sort }, { models }) => {
      return comments(models, id, sort)
    },
    search: async (parent, { q: query, sub, cursor }, { models, search }) => {
      const decodedCursor = decodeCursor(cursor)
      let sitems

      try {
        sitems = await search.search({
          index: 'item',
          size: LIMIT,
          from: decodedCursor.offset,
          body: {
            query: {
              bool: {
                must: [
                  sub
                    ? { term: { 'sub.name': sub } }
                    : { bool: { must_not: { exists: { field: 'sub.name' } } } },
                  {
                    bool: {
                      should: [
                        {
                        // all terms are matched in fields
                          multi_match: {
                            query,
                            type: 'most_fields',
                            fields: ['title^20', 'text'],
                            minimum_should_match: '100%',
                            boost: 400
                          }
                        },
                        {
                          // all terms are matched in fields
                          multi_match: {
                            query,
                            type: 'most_fields',
                            fields: ['title^20', 'text'],
                            fuzziness: 'AUTO',
                            prefix_length: 3,
                            minimum_should_match: '100%',
                            boost: 20
                          }
                        },
                        {
                          // only some terms must match
                          multi_match: {
                            query,
                            type: 'most_fields',
                            fields: ['title^20', 'text'],
                            fuzziness: 'AUTO',
                            prefix_length: 3,
                            minimum_should_match: '60%'
                          }
                        }
                        // TODO: add wildcard matches for
                        // user.name and url
                      ]
                    }
                  }
                ],
                filter: {
                  range: {
                    createdAt: {
                      lte: decodedCursor.time
                    }
                  }
                }
              }
            },
            highlight: {
              fields: {
                title: { number_of_fragments: 0, pre_tags: [':high['], post_tags: [']'] },
                text: { number_of_fragments: 0, pre_tags: [':high['], post_tags: [']'] }
              }
            }
          }
        })
      } catch (e) {
        console.log(e)
        return {
          cursor: null,
          items: []
        }
      }

      // return highlights
      const items = sitems.body.hits.hits.map(e => {
        const item = e._source

        item.searchTitle = (e.highlight.title && e.highlight.title[0]) || item.title
        item.searchText = (e.highlight.text && e.highlight.text[0]) || item.text

        return item
      })

      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    },
    auctionPosition: async (parent, { id, sub, bid }, { models }) => {
      // count items that have a bid gte to the current bid + 1000 or
      // gte current bid and older
      const where = {
        where: {
          subName: sub,
          OR: [{
            maxBid: {
              gte: bid + 1000
            }
          }, {
            AND: [{
              maxBid: {
                gte: bid
              }
            }, {
              createdAt: {
                lt: new Date()
              }
            }]
          }]
        }
      }

      if (id) {
        where.where.id = { not: Number(id) }
      }

      return await models.item.count(where) + 1
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

      // if it's not the FAQ and older than 10 minutes
      if (item.id !== 349 && Date.now() > new Date(item.createdAt).getTime() + 10 * 60000) {
        throw new UserInputError('item can no longer be editted')
      }

      return await updateItem(parent, { id, data: { title, text } }, { me, models })
    },
    upsertJob: async (parent, { id, sub, title, text, url, maxBid }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in to create job')
      }

      if (!sub) {
        throw new UserInputError('jobs must have a sub', { argumentName: 'sub' })
      }

      const fullSub = await models.sub.findUnique({ where: { name: sub } })
      if (!fullSub) {
        throw new UserInputError('not a valid sub', { argumentName: 'sub' })
      }

      const params = { title, text, url }
      for (const param in params) {
        if (!params[param]) {
          throw new UserInputError(`jobs must have ${param}`, { argumentName: param })
        }
      }

      if (fullSub.baseCost > maxBid) {
        throw new UserInputError(`bid must be at least ${fullSub.baseCost}`, { argumentName: 'maxBid' })
      }

      const data = {
        title,
        text,
        url,
        maxBid,
        subName: sub,
        userId: me.id
      }

      if (id) {
        return await models.item.update({
          where: { id: Number(id) },
          data
        })
      }

      return await models.item.create({
        data
      })
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
    act: async (parent, { id, sats }, { me, models }) => {
      // need to make sure we are logged in
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      if (sats <= 0) {
        throw new UserInputError('sats must be positive', { argumentName: 'sats' })
      }

      // disallow self tips
      const [item] = await models.$queryRaw(`
      ${SELECT}
      FROM "Item"
      WHERE id = $1 AND "userId" = $2`, Number(id), me.id)
      if (item) {
        throw new UserInputError('cannot tip your self')
      }

      const [{ item_act: vote }] = await serialize(models, models.$queryRaw`SELECT item_act(${Number(id)}, ${me.id}, 'TIP', ${Number(sats)})`)

      return {
        vote,
        sats
      }
    }
  },

  Item: {
    sub: async (item, args, { models }) => {
      if (!item.subName) {
        return null
      }

      return await models.sub.findUnique({ where: { name: item.subName } })
    },
    position: async (item, args, { models }) => {
      if (!item.pinId) {
        return null
      }

      const pin = await models.pin.findUnique({ where: { id: item.pinId } })
      if (!pin) {
        return null
      }

      return pin.position
    },
    prior: async (item, args, { models }) => {
      if (!item.pinId) {
        return null
      }

      const prior = await models.item.findFirst({
        where: {
          pinId: item.pinId,
          createdAt: {
            lt: item.createdAt
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      if (!prior) {
        return null
      }

      return prior.id
    },
    user: async (item, args, { models }) =>
      await models.user.findUnique({ where: { id: item.userId } }),
    ncomments: async (item, args, { models }) => {
      const [{ count }] = await models.$queryRaw`
        SELECT count(*)
        FROM "Item"
        WHERE path <@ text2ltree(${item.path}) AND id != ${Number(item.id)}`
      return count || 0
    },
    sats: async (item, args, { models }) => {
      const { sum: { sats } } = await models.itemAct.aggregate({
        sum: {
          sats: true
        },
        where: {
          itemId: Number(item.id),
          userId: {
            not: Number(item.userId)
          },
          act: {
            not: 'BOOST'
          }
        }
      })

      return sats || 0
    },
    upvotes: async (item, args, { models }) => {
      const { sum: { sats } } = await models.itemAct.aggregate({
        sum: {
          sats: true
        },
        where: {
          itemId: Number(item.id),
          userId: {
            not: Number(item.userId)
          },
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
          itemId: Number(item.id),
          act: 'BOOST'
        }
      })

      return sats || 0
    },
    meSats: async (item, args, { me, models }) => {
      if (!me) return 0

      const { sum: { sats } } = await models.itemAct.aggregate({
        sum: {
          sats: true
        },
        where: {
          itemId: Number(item.id),
          userId: me.id,
          OR: [
            {
              act: 'TIP'
            },
            {
              act: 'VOTE'
            }
          ]
        }
      })

      return sats || 0
    },
    mine: async (item, args, { me, models }) => {
      return me?.id === item.userId
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

  // check if they've already commented on this parent ... don't allow it if so
  if (parentId) {
    const existingComment = await models.item.findFirst({
      where: {
        parentId: Number(parentId),
        userId: me.id
      }
    })

    if (existingComment) {
      throw new UserInputError("you've already commented on this item")
    }
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
  "Item".text, "Item".url, "Item"."userId", "Item"."parentId", "Item"."pinId", "Item"."maxBid",
  "Item"."subName", ltree2text("Item"."path") AS "path"`

const LEFT_JOIN_SATS_SELECT = 'SELECT i.id, SUM(CASE WHEN "ItemAct".act = \'VOTE\' THEN "ItemAct".sats ELSE 0 END) as sats,  SUM(CASE WHEN "ItemAct".act = \'BOOST\' THEN "ItemAct".sats ELSE 0 END) as boost'

// function timedLeftJoinSats (num) {
//   return `LEFT JOIN (${LEFT_JOIN_SATS_SELECT}
//   FROM "Item" i
//   JOIN "ItemAct" ON i.id = "ItemAct"."itemId" AND "ItemAct".created_at <= $${num}
//   GROUP BY i.id) x ON "Item".id = x.id`
// }

const LEFT_JOIN_WEIGHTED_SATS_SELECT = 'SELECT i.id, SUM(CASE WHEN "ItemAct".act = \'VOTE\' THEN "ItemAct".sats * users.trust ELSE 0 END) as sats,  SUM(CASE WHEN "ItemAct".act = \'BOOST\' THEN "ItemAct".sats ELSE 0 END) as boost'

function timedLeftJoinWeightedSats (num) {
  return `
  LEFT JOIN (
    ${LEFT_JOIN_WEIGHTED_SATS_SELECT}
      FROM "Item" i
      JOIN "ItemAct" ON i.id = "ItemAct"."itemId" AND "ItemAct".created_at <= $${num}
      JOIN users on "ItemAct"."userId" = users.id
      GROUP BY i.id
  ) x ON "Item".id = x.id`
}

const LEFT_JOIN_WEIGHTED_SATS =
  `LEFT JOIN (${LEFT_JOIN_SATS_SELECT}
  FROM "Item" i
  JOIN "ItemAct" ON i.id = "ItemAct"."itemId"
  GROUP BY i.id) x ON "Item".id = x.id`

// const LEFT_JOIN_SATS =
//   `LEFT JOIN (${LEFT_JOIN_SATS_SELECT}
//   FROM "Item" i
//   JOIN "ItemAct" ON i.id = "ItemAct"."itemId"
//   GROUP BY i.id) x ON "Item".id = x.id`

/* NOTE: because many items will have the same rank, we need to tie break with a unique field so pagination works */
function timedOrderBySats (num) {
  return `ORDER BY (GREATEST(x.sats-1, 0)/POWER(EXTRACT(EPOCH FROM ($${num} - "Item".created_at))/3600+2, 1.5) +
    (x.boost)/POWER(EXTRACT(EPOCH FROM ($${num} - "Item".created_at))/3600+2, 5)) DESC NULLS LAST, "Item".id DESC`
}

const ORDER_BY_SATS =
  `ORDER BY ((x.sats-1)/POWER(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - "Item".created_at))/3600+2, 1.5) +
    (x.boost)/POWER(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - "Item".created_at))/3600+2, 5)) DESC NULLS LAST, "Item".id DESC`
