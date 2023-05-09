import { UserInputError, AuthenticationError } from 'apollo-server-micro'
import { ensureProtocol, removeTracking } from '../../lib/url'
import serialize from './serial'
import { decodeCursor, LIMIT, nextCursorEncoded } from '../../lib/cursor'
import { getMetadata, metadataRuleSets } from 'page-metadata-parser'
import domino from 'domino'
import {
  BOOST_MIN, ITEM_SPAM_INTERVAL,
  MAX_TITLE_LENGTH, ITEM_FILTER_THRESHOLD, DONT_LIKE_THIS_COST, COMMENT_DEPTH_LIMIT
} from '../../lib/constants'
import { msatsToSats } from '../../lib/format'
import { parse } from 'tldts'
import uu from 'url-unshort'
import { amountSchema, bountySchema, commentSchema, discussionSchema, jobSchema, linkSchema, pollSchema, ssValidate } from '../../lib/validate'

async function comments (me, models, id, sort) {
  let orderBy
  switch (sort) {
    case 'top':
      orderBy = `ORDER BY ${await orderByNumerator(me, models)} DESC, "Item".msats DESC, "Item".id DESC`
      break
    case 'recent':
      orderBy = 'ORDER BY "Item".created_at DESC, "Item".msats DESC, "Item".id DESC'
      break
    default:
      orderBy = `ORDER BY ${await orderByNumerator(me, models)}/POWER(GREATEST(3, EXTRACT(EPOCH FROM (now_utc() - "Item".created_at))/3600), 1.3) DESC NULLS LAST, "Item".msats DESC, "Item".id DESC`
      break
  }

  const filter = await filterClause(me, models)
  if (me) {
    const [{ item_comments_with_me: comments }] = await models.$queryRaw(
      'SELECT item_comments_with_me($1, $2, $3, $4, $5)', Number(id), Number(me.id), COMMENT_DEPTH_LIMIT, filter, orderBy)
    return comments
  }

  const [{ item_comments: comments }] = await models.$queryRaw(
    'SELECT item_comments($1, $2, $3, $4)', Number(id), COMMENT_DEPTH_LIMIT, filter, orderBy)
  return comments
}

export async function getItem (parent, { id }, { me, models }) {
  const [item] = await itemQueryWithMeta({
    me,
    models,
    query: `
      ${SELECT}
      FROM "Item"
      WHERE id = $1`
  }, Number(id))
  return item
}

function topClause (within) {
  let interval = ' AND "Item".created_at >= $1 - INTERVAL '
  switch (within) {
    case 'forever':
      interval = ''
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
      interval += "'1 day'"
      break
  }
  return interval
}

async function topOrderClause (sort, me, models) {
  switch (sort) {
    case 'comments':
      return 'ORDER BY ncomments DESC'
    case 'sats':
      return 'ORDER BY msats DESC'
    default:
      return await topOrderByWeightedSats(me, models)
  }
}

export async function orderByNumerator (me, models) {
  if (me) {
    const user = await models.user.findUnique({ where: { id: me.id } })
    if (user.wildWestMode) {
      return 'GREATEST("Item"."weightedVotes", POWER("Item"."weightedVotes", 1.2)) + "Item"."weightedComments"/2'
    }
  }

  return `(CASE WHEN "Item"."weightedVotes" > "Item"."weightedDownVotes"
                THEN 1
                ELSE -1 END
          * GREATEST(ABS("Item"."weightedVotes" - "Item"."weightedDownVotes"), POWER(ABS("Item"."weightedVotes" - "Item"."weightedDownVotes"), 1.2))
          + "Item"."weightedComments"/2)`
}

export async function filterClause (me, models) {
  // by default don't include freebies unless they have upvotes
  let clause = ' AND (NOT "Item".freebie OR "Item"."weightedVotes" - "Item"."weightedDownVotes" > 0'
  if (me) {
    const user = await models.user.findUnique({ where: { id: me.id } })
    // wild west mode has everything
    if (user.wildWestMode) {
      return ''
    }
    // greeter mode includes freebies if feebies haven't been flagged
    if (user.greeterMode) {
      clause = ' AND (NOT "Item".freebie OR ("Item"."weightedVotes" - "Item"."weightedDownVotes" >= 0 AND "Item".freebie)'
    }

    // always include if it's mine
    clause += ` OR "Item"."userId" = ${me.id})`
  } else {
    // close default freebie clause
    clause += ')'
  }

  // if the item is above the threshold or is mine
  clause += ` AND ("Item"."weightedVotes" - "Item"."weightedDownVotes" > -${ITEM_FILTER_THRESHOLD}`
  if (me) {
    clause += ` OR "Item"."userId" = ${me.id}`
  }
  clause += ')'

  return clause
}

function recentClause (type) {
  switch (type) {
    case 'links':
      return ' AND url IS NOT NULL'
    case 'discussions':
      return ' AND url IS NULL AND bio = false AND "pollCost"  IS NULL'
    case 'polls':
      return ' AND "pollCost" IS NOT NULL'
    case 'bios':
      return ' AND bio = true'
    case 'bounties':
      return ' AND bounty IS NOT NULL'
    default:
      return ''
  }
}

// this grabs all the stuff we need to display the item list and only
// hits the db once ... orderBy needs to be duplicated on the outer query because
// joining does not preserve the order of the inner query
async function itemQueryWithMeta ({ me, models, query, orderBy = '' }, ...args) {
  if (!me) {
    return await models.$queryRaw(`
      SELECT "Item".*, to_json(users.*) as user
      FROM (
        ${query}
      ) "Item"
      JOIN users ON "Item"."userId" = users.id
      ${orderBy}`, ...args)
  } else {
    return await models.$queryRaw(`
      SELECT "Item".*, to_json(users.*) as user, COALESCE("ItemAct"."meMsats", 0) as "meMsats",
        COALESCE("ItemAct"."meDontLike", false) as "meDontLike", "Bookmark"."itemId" IS NOT NULL AS "meBookmark"
      FROM (
        ${query}
      ) "Item"
      JOIN users ON "Item"."userId" = users.id
      LEFT JOIN "Bookmark" ON "Bookmark"."itemId" = "Item".id AND "Bookmark"."userId" = ${me.id}
      LEFT JOIN LATERAL (
        SELECT "itemId", sum("ItemAct".msats) FILTER (WHERE act = 'FEE' OR act = 'TIP') AS "meMsats",
               bool_or(act = 'DONT_LIKE_THIS') AS "meDontLike"
        FROM "ItemAct"
        WHERE "ItemAct"."userId" = ${me.id}
        AND "ItemAct"."itemId" = "Item".id
        GROUP BY "ItemAct"."itemId"
      ) "ItemAct" ON true
      ${orderBy}`, ...args)
  }
}

const subClause = (sub, num, table) => {
  return sub ? ` AND ${table ? `${table}.` : ''}"subName" = $${num} ` : ''
}

export default {
  Query: {
    itemRepetition: async (parent, { parentId }, { me, models }) => {
      if (!me) return 0
      // how many of the parents starting at parentId belong to me
      const [{ item_spam: count }] = await models.$queryRaw(`SELECT item_spam($1, $2, '${ITEM_SPAM_INTERVAL}')`,
        Number(parentId), Number(me.id))

      return count
    },
    topItems: async (parent, { cursor, sort, when }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      const items = await itemQueryWithMeta({
        me,
        models,
        query: `
          ${SELECT}
          FROM "Item"
          WHERE "parentId" IS NULL AND "Item".created_at <= $1
          AND "pinId" IS NULL AND "deletedAt" IS NULL
          ${topClause(when)}
          ${await filterClause(me, models)}
          ${await topOrderClause(sort, me, models)}
          OFFSET $2
          LIMIT ${LIMIT}`,
        orderBy: await topOrderClause(sort, me, models)
      }, decodedCursor.time, decodedCursor.offset)
      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    },
    topComments: async (parent, { cursor, sort, when }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      const comments = await itemQueryWithMeta({
        me,
        models,
        query: `
          ${SELECT}
          FROM "Item"
          WHERE "parentId" IS NOT NULL
          AND "Item".created_at <= $1 AND "deletedAt" IS NULL
          ${topClause(when)}
          ${await filterClause(me, models)}
          ${await topOrderClause(sort, me, models)}
          OFFSET $2
          LIMIT ${LIMIT}`,
        orderBy: await topOrderClause(sort, me, models)
      }, decodedCursor.time, decodedCursor.offset)
      return {
        cursor: comments.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        comments
      }
    },
    items: async (parent, { sub, sort, type, cursor, name, within }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      let items; let user; let pins; let subFull

      const activeOrMine = () => {
        return me ? ` AND (status <> 'STOPPED' OR "userId" = ${me.id}) ` : ' AND status <> \'STOPPED\' '
      }

      // HACK we want to optionally include the subName in the query
      // but the query planner doesn't like unused parameters
      const subArr = sub ? [sub] : []

      switch (sort) {
        case 'user':
          if (!name) {
            throw new UserInputError('must supply name', { argumentName: 'name' })
          }

          user = await models.user.findUnique({ where: { name } })
          if (!user) {
            throw new UserInputError('no user has that name', { argumentName: 'name' })
          }

          items = await itemQueryWithMeta({
            me,
            models,
            query: `
              ${SELECT}
              FROM "Item"
              WHERE "userId" = $1 AND "parentId" IS NULL AND created_at <= $2
              AND "pinId" IS NULL
              ${activeOrMine()}
              ${await filterClause(me, models)}
              ORDER BY created_at DESC
              OFFSET $3
              LIMIT ${LIMIT}`,
            orderBy: 'ORDER BY "Item"."createdAt" DESC'
          }, user.id, decodedCursor.time, decodedCursor.offset)
          break
        case 'recent':
          items = await itemQueryWithMeta({
            me,
            models,
            query: `
              ${SELECT}
              FROM "Item"
              WHERE "parentId" IS NULL AND created_at <= $1
              ${subClause(sub, 3)}
              ${activeOrMine()}
              ${await filterClause(me, models)}
              ${recentClause(type)}
              ORDER BY created_at DESC
              OFFSET $2
              LIMIT ${LIMIT}`,
            orderBy: 'ORDER BY "Item"."createdAt" DESC'
          }, decodedCursor.time, decodedCursor.offset, ...subArr)
          break
        case 'top':
          items = await itemQueryWithMeta({
            me,
            models,
            query: `
              ${SELECT}
              FROM "Item"
              WHERE "parentId" IS NULL AND "Item".created_at <= $1
              AND "pinId" IS NULL AND "deletedAt" IS NULL
              ${topClause(within)}
              ${await filterClause(me, models)}
              ${await topOrderByWeightedSats(me, models)}
              OFFSET $2
              LIMIT ${LIMIT}`,
            orderBy: await topOrderByWeightedSats(me, models)
          }, decodedCursor.time, decodedCursor.offset)
          break
        default:
          // sub so we know the default ranking
          if (sub) {
            subFull = await models.sub.findUnique({ where: { name: sub } })
          }

          switch (subFull?.rankingType) {
            case 'AUCTION':
              items = await itemQueryWithMeta({
                me,
                models,
                query: `
                  ${SELECT},
                    CASE WHEN status = 'ACTIVE' AND "maxBid" > 0
                         THEN 0 ELSE 1 END AS group_rank,
                    CASE WHEN status = 'ACTIVE' AND "maxBid" > 0
                         THEN rank() OVER (ORDER BY "maxBid" DESC, created_at ASC)
                         ELSE rank() OVER (ORDER BY created_at DESC) END AS rank
                    FROM "Item"
                    WHERE "parentId" IS NULL AND created_at <= $1
                    AND "pinId" IS NULL
                    ${subClause(sub, 3)}
                    AND status IN ('ACTIVE', 'NOSATS')
                    ORDER BY group_rank, rank
                  OFFSET $2
                  LIMIT ${LIMIT}`,
                orderBy: 'ORDER BY group_rank, rank'
              }, decodedCursor.time, decodedCursor.offset, ...subArr)
              break
            default:
              // HACK we can speed hack the first hot page, by limiting our query to only
              // the most recently created items so that the tables doesn't have to
              // fully be computed
              // if the offset is 0, we limit our search to posts from the last week
              // if there are 21 items, return them ... if not do the unrestricted query
              // instead of doing this we should materialize a view ... but this is easier for now
              if (decodedCursor.offset === 0) {
                items = await itemQueryWithMeta({
                  me,
                  models,
                  query: `
                    ${SELECT}
                    FROM "Item"
                    WHERE "parentId" IS NULL AND "Item".created_at <= $1 AND "Item".created_at > $3
                    AND "pinId" IS NULL AND NOT bio AND "deletedAt" IS NULL
                    ${subClause(sub, 4)}
                    ${await filterClause(me, models)}
                    ${await newTimedOrderByWeightedSats(me, models, 1)}
                    OFFSET $2
                    LIMIT ${LIMIT}`,
                  orderBy: await newTimedOrderByWeightedSats(me, models, 1)
                }, decodedCursor.time, decodedCursor.offset, new Date(new Date().setDate(new Date().getDate() - 5)), ...subArr)
              }

              if (decodedCursor.offset !== 0 || items?.length < LIMIT) {
                items = await itemQueryWithMeta({
                  me,
                  models,
                  query: `
                    ${SELECT}
                    FROM "Item"
                    WHERE "parentId" IS NULL AND "Item".created_at <= $1
                    AND "pinId" IS NULL AND NOT bio AND "deletedAt" IS NULL
                    ${subClause(sub, 3)}
                    ${await filterClause(me, models)}
                    ${await newTimedOrderByWeightedSats(me, models, 1)}
                    OFFSET $2
                    LIMIT ${LIMIT}`,
                  orderBy: await newTimedOrderByWeightedSats(me, models, 1)
                }, decodedCursor.time, decodedCursor.offset, ...subArr)
              }

              if (decodedCursor.offset === 0) {
                // get pins for the page and return those separately
                pins = await itemQueryWithMeta({
                  me,
                  models,
                  query: `
                    SELECT rank_filter.*
                      FROM (
                        ${SELECT},
                        rank() OVER (
                            PARTITION BY "pinId"
                            ORDER BY created_at DESC
                        )
                        FROM "Item"
                        WHERE "pinId" IS NOT NULL
                        ${subClause(sub, 1)}
                    ) rank_filter WHERE RANK = 1`
                }, ...subArr)
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
    allItems: async (parent, { cursor }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      const items = await itemQueryWithMeta({
        me,
        models,
        query: `
          ${SELECT}
          FROM "Item"
          ORDER BY created_at DESC
          OFFSET $1
          LIMIT ${LIMIT}`,
        orderBy: 'ORDER BY "Item"."createdAt" DESC'
      }, decodedCursor.offset)
      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    },
    outlawedItems: async (parent, { cursor }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      const notMine = () => {
        return me ? ` AND "userId" <> ${me.id} ` : ''
      }

      const items = await itemQueryWithMeta({
        me,
        models,
        query: `
          ${SELECT}
          FROM "Item"
          WHERE "Item"."weightedVotes" - "Item"."weightedDownVotes" <= -${ITEM_FILTER_THRESHOLD}
          ${notMine()}
          ORDER BY created_at DESC
          OFFSET $1
          LIMIT ${LIMIT}`,
        orderBy: 'ORDER BY "Item"."createdAt" DESC'
      }, decodedCursor.offset)
      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    },
    borderlandItems: async (parent, { cursor }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      const notMine = () => {
        return me ? ` AND "userId" <> ${me.id} ` : ''
      }

      const items = await itemQueryWithMeta({
        me,
        models,
        query: `
          ${SELECT}
          FROM "Item"
          WHERE "Item"."weightedVotes" - "Item"."weightedDownVotes" < 0
          AND "Item"."weightedVotes" - "Item"."weightedDownVotes" > -${ITEM_FILTER_THRESHOLD}
          ${notMine()}
          ORDER BY created_at DESC
          OFFSET $1
          LIMIT ${LIMIT}`,
        orderBy: 'ORDER BY "Item"."createdAt" DESC'
      }, decodedCursor.offset)
      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    },
    freebieItems: async (parent, { cursor }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)

      const items = await itemQueryWithMeta({
        me,
        models,
        query: `
          ${SELECT}
          FROM "Item"
          WHERE "Item".freebie
          ORDER BY created_at DESC
          OFFSET $1
          LIMIT ${LIMIT}`,
        orderBy: 'ORDER BY "Item"."createdAt" DESC'
      }, decodedCursor.offset)
      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    },
    getBountiesByUserName: async (parent, { name, cursor, limit }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      const user = await models.user.findUnique({ where: { name } })

      if (!user) {
        throw new UserInputError('user not found', {
          argumentName: 'name'
        })
      }

      const items = await itemQueryWithMeta({
        me,
        models,
        query: `
          ${SELECT}
          FROM "Item"
          WHERE "userId" = $1
          AND "bounty" IS NOT NULL
          ORDER BY created_at DESC
          OFFSET $2
          LIMIT $3`,
        orderBy: 'ORDER BY "Item"."createdAt" DESC'
      }, user.id, decodedCursor.offset, limit || LIMIT)

      return {
        cursor: items.length === (limit || LIMIT) ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    },
    moreFlatComments: async (parent, { sub, cursor, name, sort, within }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      // HACK we want to optionally include the subName in the query
      // but the query planner doesn't like unused parameters
      const subArr = sub ? [sub] : []

      let comments, user
      switch (sort) {
        case 'recent':
          comments = await itemQueryWithMeta({
            me,
            models,
            query: `
              ${SELECT}
              FROM "Item"
              JOIN "Item" root ON "Item"."rootId" = root.id
              WHERE "Item"."parentId" IS NOT NULL AND "Item".created_at <= $1
              ${subClause(sub, 3, 'root')}
              ${await filterClause(me, models)}
              ORDER BY "Item".created_at DESC
              OFFSET $2
              LIMIT ${LIMIT}`,
            orderBy: 'ORDER BY "Item"."createdAt" DESC'
          }, decodedCursor.time, decodedCursor.offset, ...subArr)
          break
        case 'user':
          if (!name) {
            throw new UserInputError('must supply name', { argumentName: 'name' })
          }

          user = await models.user.findUnique({ where: { name } })
          if (!user) {
            throw new UserInputError('no user has that name', { argumentName: 'name' })
          }

          comments = await itemQueryWithMeta({
            me,
            models,
            query: `
              ${SELECT}
              FROM "Item"
              WHERE "userId" = $1 AND "parentId" IS NOT NULL
              AND created_at <= $2
              ${await filterClause(me, models)}
              ORDER BY created_at DESC
              OFFSET $3
              LIMIT ${LIMIT}`,
            orderBy: 'ORDER BY "Item"."createdAt" DESC'
          }, user.id, decodedCursor.time, decodedCursor.offset)
          break
        case 'top':
          comments = await itemQueryWithMeta({
            me,
            models,
            query: `
              ${SELECT}
              FROM "Item"
              WHERE "Item"."parentId" IS NOT NULL AND"Item"."deletedAt" IS NULL
              AND "Item".created_at <= $1
              ${topClause(within)}
              ${await filterClause(me, models)}
              ${await topOrderByWeightedSats(me, models)}
              OFFSET $2
              LIMIT ${LIMIT}`,
            orderBy: await topOrderByWeightedSats(me, models)
          }, decodedCursor.time, decodedCursor.offset)
          break
        default:
          throw new UserInputError('invalid sort type', { argumentName: 'sort' })
      }

      return {
        cursor: comments.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        comments
      }
    },
    moreBookmarks: async (parent, { cursor, name }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)

      const user = await models.user.findUnique({ where: { name } })
      if (!user) {
        throw new UserInputError('no user has that name', { argumentName: 'name' })
      }

      const items = await itemQueryWithMeta({
        me,
        models,
        query: `
          ${SELECT}, "Bookmark".created_at as "bookmarkCreatedAt"
          FROM "Item"
          JOIN "Bookmark" ON "Bookmark"."itemId" = "Item"."id" AND "Bookmark"."userId" = $1
          AND "Bookmark".created_at <= $2
          ORDER BY "Bookmark".created_at DESC
          OFFSET $3
          LIMIT ${LIMIT}`,
        orderBy: 'ORDER BY "bookmarkCreatedAt" DESC'
      }, user.id, decodedCursor.time, decodedCursor.offset)

      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    },
    item: getItem,
    pageTitleAndUnshorted: async (parent, { url }, { models }) => {
      const res = {}
      try {
        const response = await fetch(ensureProtocol(url), { redirect: 'follow' })
        const html = await response.text()
        const doc = domino.createWindow(html).document
        const metadata = getMetadata(doc, url, { title: metadataRuleSets.title })
        res.title = metadata?.title
      } catch { }

      try {
        const unshorted = await uu().expand(url)
        if (unshorted) {
          res.unshorted = unshorted
        }
      } catch { }

      return res
    },
    dupes: async (parent, { url }, { me, models }) => {
      const urlObj = new URL(ensureProtocol(url))
      let uri = urlObj.hostname + urlObj.pathname
      uri = uri.endsWith('/') ? uri.slice(0, -1) : uri

      const parseResult = parse(urlObj.hostname)
      if (parseResult?.subdomain?.length) {
        const { subdomain } = parseResult
        uri = uri.replace(subdomain, '(%)?')
      } else {
        uri = `(%.)?${uri}`
      }

      let similar = `(http(s)?://)?${uri}/?`
      const whitelist = ['news.ycombinator.com/item', 'bitcointalk.org/index.php']
      const youtube = ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be']
      if (whitelist.includes(uri)) {
        similar += `\\${urlObj.search}`
      } else if (youtube.includes(urlObj.hostname)) {
        // extract id and create both links
        const matches = url.match(/(https?:\/\/)?((www\.)?(youtube(-nocookie)?|youtube.googleapis)\.com.*(v\/|v=|vi=|vi\/|e\/|embed\/|user\/.*\/u\/\d+\/)|youtu\.be\/)(?<id>[_0-9a-z-]+)/i)
        similar = `(http(s)?://)?((www.|m.)?youtube.com/(watch\\?v=|v/|live/)${matches?.groups?.id}|youtu.be/${matches?.groups?.id})((\\?|&|#)%)?`
      } else {
        similar += '((\\?|#)%)?'
      }

      return await itemQueryWithMeta({
        me,
        models,
        query: `
          ${SELECT}
          FROM "Item"
          WHERE LOWER(url) SIMILAR TO LOWER($1)
          ORDER BY created_at DESC
          LIMIT 3`
      }, similar)
    },
    comments: async (parent, { id, sort }, { me, models }) => {
      return comments(me, models, id, sort)
    },
    auctionPosition: async (parent, { id, sub, bid }, { models, me }) => {
      const createdAt = id ? (await getItem(parent, { id }, { models, me })).createdAt : new Date()
      let where
      if (bid > 0) {
        // if there's a bid
        // it's ACTIVE and has a larger bid than ours, or has an equal bid and is older
        // count items: (bid > ours.bid OR (bid = ours.bid AND create_at < ours.created_at)) AND status = 'ACTIVE'
        where = {
          status: 'ACTIVE',
          OR: [
            { maxBid: { gt: bid } },
            { maxBid: bid, createdAt: { lt: createdAt } }
          ]
        }
      } else {
        // else
        // it's an active with a bid gt ours, or its newer than ours and not STOPPED
        // count items: ((bid > ours.bid AND status = 'ACTIVE') OR (created_at > ours.created_at AND status <> 'STOPPED'))
        where = {
          OR: [
            { maxBid: { gt: 0 }, status: 'ACTIVE' },
            { createdAt: { gt: createdAt }, status: { not: 'STOPPED' } }
          ]
        }
      }

      where.subName = sub
      if (id) {
        where.id = { not: Number(id) }
      }

      return await models.item.count({ where }) + 1
    }
  },

  Mutation: {
    bookmarkItem: async (parent, { id }, { me, models }) => {
      const data = { itemId: Number(id), userId: me.id }
      const old = await models.bookmark.findUnique({ where: { userId_itemId: data } })
      if (old) {
        await models.bookmark.delete({ where: { userId_itemId: data } })
      } else await models.bookmark.create({ data })
      return { id }
    },
    deleteItem: async (parent, { id }, { me, models }) => {
      const old = await models.item.findUnique({ where: { id: Number(id) } })
      if (Number(old.userId) !== Number(me?.id)) {
        throw new AuthenticationError('item does not belong to you')
      }

      const data = { deletedAt: new Date() }
      if (old.text) {
        data.text = '*deleted by author*'
      }
      if (old.title) {
        data.title = 'deleted by author'
      }
      if (old.url) {
        data.url = null
      }
      if (old.pollCost) {
        data.pollCost = null
      }

      return await models.item.update({ where: { id: Number(id) }, data })
    },
    upsertLink: async (parent, args, { me, models }) => {
      const { id, ...data } = args
      data.url = ensureProtocol(data.url)
      data.url = removeTracking(data.url)

      await ssValidate(linkSchema, data, models)

      if (id) {
        return await updateItem(parent, { id, data }, { me, models })
      } else {
        return await createItem(parent, data, { me, models })
      }
    },
    upsertDiscussion: async (parent, args, { me, models }) => {
      const { id, ...data } = args

      await ssValidate(discussionSchema, data, models)

      if (id) {
        return await updateItem(parent, { id, data }, { me, models })
      } else {
        return await createItem(parent, data, { me, models })
      }
    },
    upsertBounty: async (parent, args, { me, models }) => {
      const { id, ...data } = args

      await ssValidate(bountySchema, data, models)

      if (id) {
        return await updateItem(parent, { id, data }, { me, models })
      } else {
        return await createItem(parent, data, { me, models })
      }
    },
    upsertPoll: async (parent, { id, ...data }, { me, models }) => {
      const { sub, forward, boost, title, text, options } = data
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      const optionCount = id
        ? await models.pollOption.count({
            where: {
              itemId: Number(id)
            }
          })
        : 0

      await ssValidate(pollSchema, data, models, optionCount)

      let fwdUser
      if (forward) {
        fwdUser = await models.user.findUnique({ where: { name: forward } })
        if (!fwdUser) {
          throw new UserInputError('forward user does not exist', { argumentName: 'forward' })
        }
      }

      if (id) {
        const old = await models.item.findUnique({ where: { id: Number(id) } })
        if (Number(old.userId) !== Number(me?.id)) {
          throw new AuthenticationError('item does not belong to you')
        }
        const [item] = await serialize(models,
          models.$queryRaw(`${SELECT} FROM update_poll($1, $2, $3, $4, $5, $6, $7) AS "Item"`,
            sub || 'bitcoin', Number(id), title, text, Number(boost || 0), options, Number(fwdUser?.id)))

        await createMentions(item, models)
        item.comments = []
        return item
      } else {
        const [item] = await serialize(models,
          models.$queryRaw(`${SELECT} FROM create_poll($1, $2, $3, $4, $5, $6, $7, $8, '${ITEM_SPAM_INTERVAL}') AS "Item"`,
            sub || 'bitcoin', title, text, 1, Number(boost || 0), Number(me.id), options, Number(fwdUser?.id)))

        await createMentions(item, models)
        item.comments = []
        return item
      }
    },
    upsertJob: async (parent, { id, ...data }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in to create job')
      }
      const { sub, title, company, location, remote, text, url, maxBid, status, logo } = data

      const fullSub = await models.sub.findUnique({ where: { name: sub } })
      if (!fullSub) {
        throw new UserInputError('not a valid sub', { argumentName: 'sub' })
      }

      await ssValidate(jobSchema, data, models)
      const loc = location.toLowerCase() === 'remote' ? undefined : location

      let item
      if (id) {
        const old = await models.item.findUnique({ where: { id: Number(id) } })
        if (Number(old.userId) !== Number(me?.id)) {
          throw new AuthenticationError('item does not belong to you')
        }
        ([item] = await serialize(models,
          models.$queryRaw(
            `${SELECT} FROM update_job($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) AS "Item"`,
            Number(id), title, url, text, Number(maxBid), company, loc, remote, Number(logo), status)))
      } else {
        ([item] = await serialize(models,
          models.$queryRaw(
            `${SELECT} FROM create_job($1, $2, $3, $4, $5, $6, $7, $8, $9) AS "Item"`,
            title, url, text, Number(me.id), Number(maxBid), company, loc, remote, Number(logo))))
      }

      await createMentions(item, models)

      return item
    },
    createComment: async (parent, data, { me, models }) => {
      await ssValidate(commentSchema, data)
      return await createItem(parent, data, { me, models })
    },
    updateComment: async (parent, { id, ...data }, { me, models }) => {
      await ssValidate(commentSchema, data)
      return await updateItem(parent, { id, data }, { me, models })
    },
    pollVote: async (parent, { id }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      await serialize(models,
        models.$queryRaw(`${SELECT} FROM poll_vote($1, $2) AS "Item"`,
          Number(id), Number(me.id)))

      return id
    },
    act: async (parent, { id, sats }, { me, models }) => {
      // need to make sure we are logged in
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      await ssValidate(amountSchema, { amount: sats })

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
    },
    dontLikeThis: async (parent, { id }, { me, models }) => {
      // need to make sure we are logged in
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      // disallow self down votes
      const [item] = await models.$queryRaw(`
            ${SELECT}
            FROM "Item"
            WHERE id = $1 AND "userId" = $2`, Number(id), me.id)
      if (item) {
        throw new UserInputError('cannot downvote your self')
      }

      await serialize(models, models.$queryRaw`SELECT item_act(${Number(id)}, ${me.id}, 'DONT_LIKE_THIS', ${DONT_LIKE_THIS_COST})`)

      return true
    }
  },
  Item: {
    sats: async (item, args, { models }) => {
      return msatsToSats(item.msats)
    },
    commentSats: async (item, args, { models }) => {
      return msatsToSats(item.commentMsats)
    },
    isJob: async (item, args, { models }) => {
      return item.subName === 'jobs'
    },
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
    poll: async (item, args, { models, me }) => {
      if (!item.pollCost) {
        return null
      }

      const options = await models.$queryRaw`
        SELECT "PollOption".id, option, count("PollVote"."userId") as count,
          coalesce(bool_or("PollVote"."userId" = ${me?.id}), 'f') as "meVoted"
        FROM "PollOption"
        LEFT JOIN "PollVote" on "PollVote"."pollOptionId" = "PollOption".id
        WHERE "PollOption"."itemId" = ${item.id}
        GROUP BY "PollOption".id
        ORDER BY "PollOption".id ASC
      `
      const poll = {}
      poll.options = options
      poll.meVoted = options.some(o => o.meVoted)
      poll.count = options.reduce((t, o) => t + o.count, 0)

      return poll
    },
    user: async (item, args, { models }) => {
      if (item.user) {
        return item.user
      }
      return await models.user.findUnique({ where: { id: item.userId } })
    },
    fwdUser: async (item, args, { models }) => {
      if (!item.fwdUserId) {
        return null
      }
      return await models.user.findUnique({ where: { id: item.fwdUserId } })
    },
    comments: async (item, args, { me, models }) => {
      if (item.comments) {
        return item.comments
      }
      return comments(me, models, item.id, item.pinId ? 'recent' : 'hot')
    },
    wvotes: async (item) => {
      return item.weightedVotes - item.weightedDownVotes
    },
    meSats: async (item, args, { me, models }) => {
      if (!me) return 0
      if (typeof item.meMsats === 'number') return msatsToSats(item.meMsats)

      const { sum: { msats } } = await models.itemAct.aggregate({
        sum: {
          msats: true
        },
        where: {
          itemId: Number(item.id),
          userId: me.id,
          OR: [
            {
              act: 'TIP'
            },
            {
              act: 'FEE'
            }
          ]
        }
      })

      return (msats && msatsToSats(msats)) || 0
    },
    meDontLike: async (item, args, { me, models }) => {
      if (!me) return false
      if (typeof item.meDontLike === 'boolean') return item.meDontLike

      const dontLike = await models.itemAct.findFirst({
        where: {
          itemId: Number(item.id),
          userId: me.id,
          act: 'DONT_LIKE_THIS'
        }
      })

      return !!dontLike
    },
    meBookmark: async (item, args, { me, models }) => {
      if (!me) return false
      if (typeof item.meBookmark === 'boolean') return item.meBookmark

      const bookmark = await models.bookmark.findUnique({
        where: {
          userId_itemId: {
            itemId: Number(item.id),
            userId: me.id
          }
        }
      })

      return !!bookmark
    },
    outlawed: async (item, args, { me, models }) => {
      if (me && Number(item.userId) === Number(me.id)) {
        return false
      }
      return item.weightedVotes - item.weightedDownVotes <= -ITEM_FILTER_THRESHOLD
    },
    mine: async (item, args, { me, models }) => {
      return me?.id === item.userId
    },
    root: async (item, args, { models }) => {
      if (!item.rootId) {
        return null
      }
      if (item.root) {
        return item.root
      }
      return await models.item.findUnique({ where: { id: item.rootId } })
    },
    parent: async (item, args, { models }) => {
      if (!item.parentId) {
        return null
      }
      return await models.item.findUnique({ where: { id: item.parentId } })
    },
    parentOtsHash: async (item, args, { models }) => {
      if (!item.parentId) {
        return null
      }
      const parent = await models.item.findUnique({ where: { id: item.parentId } })
      return parent.otsHash
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

export const updateItem = async (parent, { id, data: { sub, title, url, text, boost, forward, bounty, parentId } }, { me, models }) => {
  // update iff this item belongs to me
  const old = await models.item.findUnique({ where: { id: Number(id) } })
  if (Number(old.userId) !== Number(me?.id)) {
    throw new AuthenticationError('item does not belong to you')
  }

  // if it's not the FAQ, not their bio, and older than 10 minutes
  const user = await models.user.findUnique({ where: { id: me.id } })
  if (![349, 76894, 78763, 81862].includes(old.id) && user.bioId !== id && Date.now() > new Date(old.createdAt).getTime() + 10 * 60000) {
    throw new UserInputError('item can no longer be editted')
  }

  if (boost && boost < BOOST_MIN) {
    throw new UserInputError(`boost must be at least ${BOOST_MIN}`, { argumentName: 'boost' })
  }

  if (!old.parentId && title.length > MAX_TITLE_LENGTH) {
    throw new UserInputError('title too long')
  }

  let fwdUser
  if (forward) {
    fwdUser = await models.user.findUnique({ where: { name: forward } })
    if (!fwdUser) {
      throw new UserInputError('forward user does not exist', { argumentName: 'forward' })
    }
  }

  const [item] = await serialize(models,
    models.$queryRaw(
      `${SELECT} FROM update_item($1, $2, $3, $4, $5, $6, $7, $8) AS "Item"`,
      old.parentId ? null : sub || 'bitcoin', Number(id), title, url, text,
      Number(boost || 0), bounty ? Number(bounty) : null, Number(fwdUser?.id)))

  await createMentions(item, models)

  return item
}

const createItem = async (parent, { sub, title, url, text, boost, forward, bounty, parentId }, { me, models }) => {
  if (!me) {
    throw new AuthenticationError('you must be logged in')
  }

  if (boost && boost < BOOST_MIN) {
    throw new UserInputError(`boost must be at least ${BOOST_MIN}`, { argumentName: 'boost' })
  }

  if (!parentId && title.length > MAX_TITLE_LENGTH) {
    throw new UserInputError('title too long')
  }

  let fwdUser
  if (forward) {
    fwdUser = await models.user.findUnique({ where: { name: forward } })
    if (!fwdUser) {
      throw new UserInputError('forward user does not exist', { argumentName: 'forward' })
    }
  }

  const [item] = await serialize(
    models,
    models.$queryRaw(
    `${SELECT} FROM create_item($1, $2, $3, $4, $5, $6, $7, $8, $9, '${ITEM_SPAM_INTERVAL}') AS "Item"`,
    parentId ? null : sub || 'bitcoin',
    title,
    url,
    text,
    Number(boost || 0),
    bounty ? Number(bounty) : null,
    Number(parentId),
    Number(me.id),
    Number(fwdUser?.id)))

  await createMentions(item, models)

  item.comments = []
  return item
}

// we have to do our own query because ltree is unsupported
export const SELECT =
  `SELECT "Item".id, "Item".created_at, "Item".created_at as "createdAt", "Item".updated_at,
  "Item".updated_at as "updatedAt", "Item".title, "Item".text, "Item".url, "Item"."bounty",
  "Item"."userId", "Item"."fwdUserId", "Item"."parentId", "Item"."pinId", "Item"."maxBid",
  "Item"."rootId", "Item".upvotes, "Item".company, "Item".location, "Item".remote, "Item"."deletedAt",
  "Item"."subName", "Item".status, "Item"."uploadId", "Item"."pollCost", "Item".boost, "Item".msats,
  "Item".ncomments, "Item"."commentMsats", "Item"."lastCommentAt", "Item"."weightedVotes",
  "Item"."weightedDownVotes", "Item".freebie, "Item"."otsHash", "Item"."bountyPaidTo",
  ltree2text("Item"."path") AS "path", "Item"."weightedComments"`

async function newTimedOrderByWeightedSats (me, models, num) {
  return `
    ORDER BY (${await orderByNumerator(me, models)}/POWER(GREATEST(3, EXTRACT(EPOCH FROM ($${num} - "Item".created_at))/3600), 1.3) +
              ("Item".boost/${BOOST_MIN}::float)/POWER(EXTRACT(EPOCH FROM ($${num} - "Item".created_at))/3600+2, 2.6)) DESC NULLS LAST, "Item".id DESC`
}

async function topOrderByWeightedSats (me, models) {
  return `ORDER BY ${await orderByNumerator(me, models)} DESC NULLS LAST, "Item".id DESC`
}
