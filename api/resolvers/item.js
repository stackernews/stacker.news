import { GraphQLError } from 'graphql'
import { ensureProtocol, removeTracking } from '../../lib/url'
import { serializeInvoicable } from './serial'
import { decodeCursor, LIMIT, nextCursorEncoded } from '../../lib/cursor'
import { getMetadata, metadataRuleSets } from 'page-metadata-parser'
import domino from 'domino'
import {
  ITEM_SPAM_INTERVAL, ITEM_FILTER_THRESHOLD,
  DONT_LIKE_THIS_COST, COMMENT_DEPTH_LIMIT, COMMENT_TYPE_QUERY,
  ANON_COMMENT_FEE, ANON_USER_ID, ANON_POST_FEE, ANON_ITEM_SPAM_INTERVAL, POLL_COST
} from '../../lib/constants'
import { msatsToSats } from '../../lib/format'
import { parse } from 'tldts'
import uu from 'url-unshort'
import { advSchema, amountSchema, bountySchema, commentSchema, discussionSchema, jobSchema, linkSchema, pollSchema, ssValidate } from '../../lib/validate'
import { sendUserNotification } from '../webPush'
import { defaultCommentSort } from '../../lib/item'
import { notifyItemParents, notifyUserSubscribers, notifyZapped } from '../../lib/push-notifications'

export async function commentFilterClause (me, models) {
  let clause = ` AND ("Item"."weightedVotes" - "Item"."weightedDownVotes" > -${ITEM_FILTER_THRESHOLD}`
  if (me) {
    const user = await models.user.findUnique({ where: { id: me.id } })
    // wild west mode has everything
    if (user.wildWestMode) {
      return ''
    }

    // always include if it's mine
    clause += ` OR "Item"."userId" = ${me.id}`
  }

  // close the clause
  clause += ')'

  return clause
}

async function comments (me, models, id, sort) {
  let orderBy
  switch (sort) {
    case 'top':
      orderBy = `ORDER BY ${await orderByNumerator(me, models)} DESC, "Item".msats DESC, ("Item".freebie IS FALSE) DESC,  "Item".id DESC`
      break
    case 'recent':
      orderBy = 'ORDER BY "Item".created_at DESC, "Item".msats DESC, ("Item".freebie IS FALSE) DESC, "Item".id DESC'
      break
    default:
      orderBy = `ORDER BY ${await orderByNumerator(me, models)}/POWER(GREATEST(3, EXTRACT(EPOCH FROM (now_utc() - "Item".created_at))/3600), 1.3) DESC NULLS LAST, "Item".msats DESC, ("Item".freebie IS FALSE) DESC, "Item".id DESC`
      break
  }

  const filter = await commentFilterClause(me, models)
  if (me) {
    const [{ item_comments_with_me: comments }] = await models.$queryRawUnsafe(
      'SELECT item_comments_with_me($1::INTEGER, $2::INTEGER, $3::INTEGER, $4, $5)', Number(id), Number(me.id), COMMENT_DEPTH_LIMIT, filter, orderBy)
    return comments
  }

  const [{ item_comments: comments }] = await models.$queryRawUnsafe(
    'SELECT item_comments($1::INTEGER, $2::INTEGER, $3, $4)', Number(id), COMMENT_DEPTH_LIMIT, filter, orderBy)
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

const orderByClause = async (by, me, models, type) => {
  switch (by) {
    case 'comments':
      return 'ORDER BY "Item".ncomments DESC'
    case 'sats':
      return 'ORDER BY "Item".msats DESC'
    case 'zaprank':
      return await topOrderByWeightedSats(me, models)
    default:
      return `ORDER BY ${type === 'bookmarks' ? '"bookmarkCreatedAt"' : '"Item".created_at'} DESC`
  }
}

export async function orderByNumerator (me, models) {
  if (me) {
    const user = await models.user.findUnique({ where: { id: me.id } })
    if (user.wildWestMode) {
      return '(GREATEST("Item"."weightedVotes", POWER("Item"."weightedVotes", 1.2)) + "Item"."weightedComments"/2)'
    }
  }

  return `(CASE WHEN "Item"."weightedVotes" > "Item"."weightedDownVotes"
                THEN 1
                ELSE -1 END
          * GREATEST(ABS("Item"."weightedVotes" - "Item"."weightedDownVotes"), POWER(ABS("Item"."weightedVotes" - "Item"."weightedDownVotes"), 1.2))
          + "Item"."weightedComments"/2)`
}

export async function joinSatRankView (me, models) {
  if (me) {
    const user = await models.user.findUnique({ where: { id: me.id } })
    if (user.wildWestMode) {
      return 'JOIN zap_rank_wwm_view ON "Item".id = zap_rank_wwm_view.id'
    }
  }

  return 'JOIN zap_rank_tender_view ON "Item".id = zap_rank_tender_view.id'
}

// this grabs all the stuff we need to display the item list and only
// hits the db once ... orderBy needs to be duplicated on the outer query because
// joining does not preserve the order of the inner query
async function itemQueryWithMeta ({ me, models, query, orderBy = '' }, ...args) {
  if (!me) {
    return await models.$queryRawUnsafe(`
      SELECT "Item".*, to_json(users.*) as user
      FROM (
        ${query}
      ) "Item"
      JOIN users ON "Item"."userId" = users.id
      ${orderBy}`, ...args)
  } else {
    return await models.$queryRawUnsafe(`
      SELECT "Item".*, to_jsonb(users.*) || jsonb_build_object('meMute', "Mute"."mutedId" IS NOT NULL) as user,
        COALESCE("ItemAct"."meMsats", 0) as "meMsats",
        COALESCE("ItemAct"."meDontLike", false) as "meDontLike", b."itemId" IS NOT NULL AS "meBookmark",
        "ThreadSubscription"."itemId" IS NOT NULL AS "meSubscription", "ItemForward"."itemId" IS NOT NULL AS "meForward"
      FROM (
        ${query}
      ) "Item"
      JOIN users ON "Item"."userId" = users.id
      LEFT JOIN "Mute" ON "Mute"."muterId" = ${me.id} AND "Mute"."mutedId" = "Item"."userId"
      LEFT JOIN "Bookmark" b ON b."itemId" = "Item".id AND b."userId" = ${me.id}
      LEFT JOIN "ThreadSubscription" ON "ThreadSubscription"."itemId" = "Item".id AND "ThreadSubscription"."userId" = ${me.id}
      LEFT JOIN "ItemForward" ON "ItemForward"."itemId" = "Item".id AND "ItemForward"."userId" = ${me.id}
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

const relationClause = (type) => {
  let clause = ''
  switch (type) {
    case 'comments':
      clause += ' FROM "Item" JOIN "Item" root ON "Item"."rootId" = root.id '
      break
    case 'bookmarks':
      clause += ' FROM "Item" JOIN "Bookmark" ON "Bookmark"."itemId" = "Item"."id" '
      break
    case 'outlawed':
    case 'borderland':
    case 'freebies':
    case 'all':
      clause += ' FROM "Item" LEFT JOIN "Item" root ON "Item"."rootId" = root.id '
      break
    default:
      clause += ' FROM "Item" '
  }

  return clause
}

const selectClause = (type) => type === 'bookmarks'
  ? `${SELECT}, "Bookmark"."created_at" as "bookmarkCreatedAt"`
  : SELECT

const subClauseTable = (type) => COMMENT_TYPE_QUERY.includes(type) ? 'root' : 'Item'

export const whereClause = (...clauses) => {
  const clause = clauses.flat(Infinity).filter(c => c).join(' AND ')
  return clause ? ` WHERE ${clause} ` : ''
}

function whenClause (when, type) {
  let interval = `"${type === 'bookmarks' ? 'Bookmark' : 'Item'}".created_at >= $1 - INTERVAL `
  switch (when) {
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

const activeOrMine = (me) => {
  return me ? `("Item".status <> 'STOPPED' OR "Item"."userId" = ${me.id})` : '"Item".status <> \'STOPPED\''
}

export const muteClause = me =>
  me ? `NOT EXISTS (SELECT 1 FROM "Mute" WHERE "Mute"."muterId" = ${me.id} AND "Mute"."mutedId" = "Item"."userId")` : ''

const subClause = (sub, num, table) => {
  return sub ? `${table ? `"${table}".` : ''}"subName" = $${num}` : ''
}

export async function filterClause (me, models, type) {
  // if you are explicitly asking for marginal content, don't filter them
  if (['outlawed', 'borderland', 'freebies'].includes(type)) {
    if (me && ['outlawed', 'borderland'].includes(type)) {
      // unless the item is mine
      return `"Item"."userId" <> ${me.id}`
    }

    return ''
  }

  // handle freebies
  // by default don't include freebies unless they have upvotes
  let freebieClauses = ['NOT "Item".freebie', '"Item"."weightedVotes" - "Item"."weightedDownVotes" > 0']
  if (me) {
    const user = await models.user.findUnique({ where: { id: me.id } })
    // wild west mode has everything
    if (user.wildWestMode) {
      return ''
    }
    // greeter mode includes freebies if feebies haven't been flagged
    if (user.greeterMode) {
      freebieClauses = ['NOT "Item".freebie', '"Item"."weightedVotes" - "Item"."weightedDownVotes" >= 0']
    }

    // always include if it's mine
    freebieClauses.push(`"Item"."userId" = ${me.id}`)
  }
  const freebieClause = '(' + freebieClauses.join(' OR ') + ')'

  // handle outlawed
  // if the item is above the threshold or is mine
  const outlawClauses = [`"Item"."weightedVotes" - "Item"."weightedDownVotes" > -${ITEM_FILTER_THRESHOLD}`]
  if (me) {
    outlawClauses.push(`"Item"."userId" = ${me.id}`)
  }
  const outlawClause = '(' + outlawClauses.join(' OR ') + ')'

  return [freebieClause, outlawClause]
}

function typeClause (type) {
  switch (type) {
    case 'links':
      return ['"Item".url IS NOT NULL', '"Item"."parentId" IS NULL']
    case 'discussions':
      return ['"Item".url IS NULL', '"Item".bio = false', '"Item"."pollCost" IS NULL', '"Item"."parentId" IS NULL']
    case 'polls':
      return ['"Item"."pollCost" IS NOT NULL', '"Item"."parentId" IS NULL']
    case 'bios':
      return ['"Item".bio = true', '"Item"."parentId" IS NULL']
    case 'bounties':
      return ['"Item".bounty IS NOT NULL', '"Item"."parentId" IS NULL']
    case 'comments':
      return '"Item"."parentId" IS NOT NULL'
    case 'freebies':
      return '"Item".freebie'
    case 'outlawed':
      return `"Item"."weightedVotes" - "Item"."weightedDownVotes" <= -${ITEM_FILTER_THRESHOLD}`
    case 'borderland':
      return '"Item"."weightedVotes" - "Item"."weightedDownVotes" < 0'
    case 'all':
    case 'bookmarks':
      return ''
    case 'jobs':
      return '"Item"."subName" = \'jobs\''
    default:
      return '"Item"."parentId" IS NULL'
  }
}

export default {
  Query: {
    itemRepetition: async (parent, { parentId }, { me, models }) => {
      if (!me) return 0
      // how many of the parents starting at parentId belong to me
      const [{ item_spam: count }] = await models.$queryRawUnsafe(`SELECT item_spam($1::INTEGER, $2::INTEGER, '${ITEM_SPAM_INTERVAL}')`,
        Number(parentId), Number(me.id))

      return count
    },
    items: async (parent, { sub, sort, type, cursor, name, when, by, limit = LIMIT }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      let items, user, pins, subFull, table

      // special authorization for bookmarks depending on owning users' privacy settings
      if (type === 'bookmarks' && name && me?.name !== name) {
        // the calling user is either not logged in, or not the user upon which the query is made,
        // so we need to check authz
        user = await models.user.findUnique({ where: { name } })
        if (user?.hideBookmarks) {
          // early return with no results if bookmarks are hidden
          return {
            cursor: null,
            items: [],
            pins: []
          }
        }
      }

      // HACK we want to optionally include the subName in the query
      // but the query planner doesn't like unused parameters
      const subArr = sub ? [sub] : []

      switch (sort) {
        case 'user':
          if (!name) {
            throw new GraphQLError('must supply name', { extensions: { code: 'BAD_INPUT' } })
          }

          user ??= await models.user.findUnique({ where: { name } })
          if (!user) {
            throw new GraphQLError('no user has that name', { extensions: { code: 'BAD_INPUT' } })
          }

          table = type === 'bookmarks' ? 'Bookmark' : 'Item'
          items = await itemQueryWithMeta({
            me,
            models,
            query: `
              ${selectClause(type)}
              ${relationClause(type)}
              ${whereClause(
                `"${table}"."userId" = $2`,
                `"${table}".created_at <= $1`,
                subClause(sub, 5, subClauseTable(type)),
                activeOrMine(me),
                await filterClause(me, models, type),
                typeClause(type),
                whenClause(when || 'forever', type))}
              ${await orderByClause(by, me, models, type)}
              OFFSET $3
              LIMIT $4`,
            orderBy: await orderByClause(by, me, models, type)
          }, decodedCursor.time, user.id, decodedCursor.offset, limit, ...subArr)
          break
        case 'recent':
          items = await itemQueryWithMeta({
            me,
            models,
            query: `
              ${SELECT}
              ${relationClause(type)}
              ${whereClause(
                '"Item".created_at <= $1',
                subClause(sub, 4, subClauseTable(type)),
                activeOrMine(me),
                await filterClause(me, models, type),
                typeClause(type),
                muteClause(me)
              )}
              ORDER BY "Item".created_at DESC
              OFFSET $2
              LIMIT $3`,
            orderBy: 'ORDER BY "Item"."createdAt" DESC'
          }, decodedCursor.time, decodedCursor.offset, limit, ...subArr)
          break
        case 'top':
          items = await itemQueryWithMeta({
            me,
            models,
            query: `
              ${selectClause(type)}
              ${relationClause(type)}
              ${whereClause(
                '"Item".created_at <= $1',
                '"Item"."pinId" IS NULL',
                '"Item"."deletedAt" IS NULL',
                subClause(sub, 4, subClauseTable(type)),
                typeClause(type),
                whenClause(when, type),
                await filterClause(me, models, type),
                muteClause(me))}
              ${await orderByClause(by || 'zaprank', me, models, type)}
              OFFSET $2
              LIMIT $3`,
            orderBy: await orderByClause(by || 'zaprank', me, models, type)
          }, decodedCursor.time, decodedCursor.offset, limit, ...subArr)
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
                    ${whereClause(
                      '"parentId" IS NULL',
                      'created_at <= $1',
                      '"pinId" IS NULL',
                      subClause(sub, 4),
                      "status IN ('ACTIVE', 'NOSATS')"
                    )}
                    ORDER BY group_rank, rank
                  OFFSET $2
                  LIMIT $3`,
                orderBy: 'ORDER BY group_rank, rank'
              }, decodedCursor.time, decodedCursor.offset, limit, ...subArr)
              break
            default:
              items = await itemQueryWithMeta({
                me,
                models,
                query: `
                    ${SELECT}, rank
                    FROM "Item"
                    ${await joinSatRankView(me, models)}
                    ${whereClause(
                      subClause(sub, 3, 'Item', true),
                      muteClause(me))}
                    ORDER BY rank ASC
                    OFFSET $1
                    LIMIT $2`,
                orderBy: 'ORDER BY rank ASC'
              }, decodedCursor.offset, limit, ...subArr)

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
                            ORDER BY "Item".created_at DESC
                        )
                        FROM "Item"
                        ${whereClause(
                          '"pinId" IS NOT NULL',
                          subClause(sub, 1),
                          muteClause(me))}
                    ) rank_filter WHERE RANK = 1`
                }, ...subArr)
              }
              break
          }
          break
      }
      return {
        cursor: items.length === limit ? nextCursorEncoded(decodedCursor) : null,
        items,
        pins
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
      let uri = urlObj.hostname + '(:[0-9]+)?' + urlObj.pathname
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
    subscribeItem: async (parent, { id }, { me, models }) => {
      const data = { itemId: Number(id), userId: me.id }
      const old = await models.threadSubscription.findUnique({ where: { userId_itemId: data } })
      if (old) {
        await models.threadSubscription.delete({ where: { userId_itemId: data } })
      } else await models.threadSubscription.create({ data })
      return { id }
    },
    deleteItem: async (parent, { id }, { me, models }) => {
      const old = await models.item.findUnique({ where: { id: Number(id) } })
      if (Number(old.userId) !== Number(me?.id)) {
        throw new GraphQLError('item does not belong to you', { extensions: { code: 'FORBIDDEN' } })
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
    upsertLink: async (parent, { id, hash, hmac, ...item }, { me, models, lnd }) => {
      await ssValidate(linkSchema, item, { models, me })

      if (id) {
        return await updateItem(parent, { id, ...item }, { me, models, lnd, hash, hmac })
      } else {
        return await createItem(parent, item, { me, models, lnd, hash, hmac })
      }
    },
    upsertDiscussion: async (parent, { id, hash, hmac, ...item }, { me, models, lnd }) => {
      await ssValidate(discussionSchema, item, { models, me })

      if (id) {
        return await updateItem(parent, { id, ...item }, { me, models, lnd, hash, hmac })
      } else {
        return await createItem(parent, item, { me, models, lnd, hash, hmac })
      }
    },
    upsertBounty: async (parent, { id, hash, hmac, ...item }, { me, models, lnd }) => {
      await ssValidate(bountySchema, item, { models, me })

      if (id) {
        return await updateItem(parent, { id, ...item }, { me, models, lnd, hash, hmac })
      } else {
        return await createItem(parent, item, { me, models, lnd, hash, hmac })
      }
    },
    upsertPoll: async (parent, { id, hash, hmac, ...item }, { me, models, lnd }) => {
      const numExistingChoices = id
        ? await models.pollOption.count({
          where: {
            itemId: Number(id)
          }
        })
        : 0

      await ssValidate(pollSchema, item, { models, me, numExistingChoices })

      if (id) {
        return await updateItem(parent, { id, ...item }, { me, models, lnd, hash, hmac })
      } else {
        item.pollCost = item.pollCost || POLL_COST
        return await createItem(parent, item, { me, models, lnd, hash, hmac })
      }
    },
    upsertJob: async (parent, { id, hash, hmac, ...item }, { me, models, lnd }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in to create job', { extensions: { code: 'FORBIDDEN' } })
      }

      item.location = item.location?.toLowerCase() === 'remote' ? undefined : item.location
      await ssValidate(jobSchema, item, { models })
      if (item.logo !== undefined) {
        item.uploadId = item.logo
        delete item.logo
      }
      item.maxBid ??= 0

      if (id) {
        return await updateItem(parent, { id, ...item }, { me, models })
      } else {
        return await createItem(parent, item, { me, models, lnd, hash, hmac })
      }
    },
    upsertComment: async (parent, { id, hash, hmac, ...item }, { me, models, lnd }) => {
      await ssValidate(commentSchema, item)

      if (id) {
        return await updateItem(parent, { id, ...item }, { me, models })
      } else {
        item = await createItem(parent, item, { me, models, lnd, hash, hmac })
        notifyItemParents({ item, me, models })
        return item
      }
    },
    pollVote: async (parent, { id, hash, hmac }, { me, models, lnd }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
      }

      await serializeInvoicable(
        models.$queryRawUnsafe(`${SELECT} FROM poll_vote($1::INTEGER, $2::INTEGER) AS "Item"`, Number(id), Number(me.id)),
        { me, models, lnd, hash, hmac }
      )

      return id
    },
    act: async (parent, { id, sats, hash, hmac }, { me, models, lnd }) => {
      await ssValidate(amountSchema, { amount: sats })

      // disallow self tips except anons
      if (me) {
        const [item] = await models.$queryRawUnsafe(`
        ${SELECT}
        FROM "Item"
        WHERE id = $1 AND "userId" = $2`, Number(id), me.id)
        if (item) {
          throw new GraphQLError('cannot zap your self', { extensions: { code: 'BAD_INPUT' } })
        }

        // Disallow tips if me is one of the forward user recipients
        const existingForwards = await models.itemForward.findMany({ where: { itemId: Number(id) } })
        if (existingForwards.some(fwd => Number(fwd.userId) === Number(me.id))) {
          throw new GraphQLError('cannot zap a post for which you are forwarded zaps', { extensions: { code: 'BAD_INPUT' } })
        }
      }

      const { item_act: vote } = await serializeInvoicable(
        models.$queryRaw`
          SELECT
            item_act(${Number(id)}::INTEGER,
            ${me?.id || ANON_USER_ID}::INTEGER, 'TIP', ${Number(sats)}::INTEGER)`,
        { me, models, lnd, hash, hmac, enforceFee: sats }
      )

      notifyZapped({ models, id })

      return {
        vote,
        sats
      }
    },
    dontLikeThis: async (parent, { id, sats = DONT_LIKE_THIS_COST, hash, hmac }, { me, lnd, models }) => {
      // need to make sure we are logged in
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
      }

      // disallow self down votes
      const [item] = await models.$queryRawUnsafe(`
            ${SELECT}
            FROM "Item"
            WHERE id = $1 AND "userId" = $2`, Number(id), me.id)
      if (item) {
        throw new GraphQLError('cannot downvote your self', { extensions: { code: 'BAD_INPUT' } })
      }

      await serializeInvoicable(
        models.$queryRaw`SELECT item_act(${Number(id)}::INTEGER,
          ${me.id}::INTEGER, 'DONT_LIKE_THIS', ${sats}::INTEGER)`,
        { me, models, lnd, hash, hmac }
      )

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
      if (!item.subName && !item.root) {
        return null
      }

      return await models.sub.findUnique({ where: { name: item.subName || item.root?.subName } })
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
        SELECT "PollOption".id, option, count("PollVote"."userId")::INTEGER as count,
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
    forwards: async (item, args, { models }) => {
      return await models.itemForward.findMany({
        where: {
          itemId: item.id
        },
        include: {
          user: true
        }
      })
    },
    comments: async (item, { sort }, { me, models }) => {
      if (typeof item.comments !== 'undefined') return item.comments
      if (item.ncomments === 0) return []

      return comments(me, models, item.id, sort || defaultCommentSort(item.pinId, item.bioId, item.createdAt))
    },
    wvotes: async (item) => {
      return item.weightedVotes - item.weightedDownVotes
    },
    meSats: async (item, args, { me, models }) => {
      if (!me) return 0
      if (typeof item.meMsats !== 'undefined') {
        return msatsToSats(item.meMsats)
      }

      const { _sum: { msats } } = await models.itemAct.aggregate({
        _sum: {
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
      if (typeof item.meDontLike !== 'undefined') return item.meDontLike

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
      if (typeof item.meBookmark !== 'undefined') return item.meBookmark

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
    meSubscription: async (item, args, { me, models }) => {
      if (!me) return false
      if (typeof item.meSubscription !== 'undefined') return item.meSubscription

      const subscription = await models.threadSubscription.findUnique({
        where: {
          userId_itemId: {
            itemId: Number(item.id),
            userId: me.id
          }
        }
      })

      return !!subscription
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
        sendUserNotification(user.id, {
          title: 'you were mentioned',
          body: item.text,
          item,
          tag: 'MENTION'
        }).catch(console.error)
      })
    }
  } catch (e) {
    console.log('mention failure', e)
  }
}

export const updateItem = async (parent, { sub: subName, forward, options, ...item }, { me, models, lnd, hash, hmac }) => {
  // update iff this item belongs to me
  const old = await models.item.findUnique({ where: { id: Number(item.id) } })
  if (Number(old.userId) !== Number(me?.id)) {
    throw new GraphQLError('item does not belong to you', { extensions: { code: 'FORBIDDEN' } })
  }

  // in case they lied about their existing boost
  await ssValidate(advSchema, { boost: item.boost }, { models, me, existingBoost: old.boost })

  // if it's not the FAQ, not their bio, and older than 10 minutes
  const user = await models.user.findUnique({ where: { id: me.id } })
  if (![349, 76894, 78763, 81862].includes(old.id) && user.bioId !== old.id &&
    typeof item.maxBid === 'undefined' && Date.now() > new Date(old.createdAt).getTime() + 10 * 60000) {
    throw new GraphQLError('item can no longer be editted', { extensions: { code: 'BAD_INPUT' } })
  }

  if (item.url && typeof item.maxBid === 'undefined') {
    item.url = ensureProtocol(item.url)
    item.url = removeTracking(item.url)
  }
  // only update item with the boost delta ... this is a bit of hack given the way
  // boost used to work
  if (item.boost > 0 && old.boost > 0) {
    // only update the boost if it is higher than the old boost
    if (item.boost > old.boost) {
      item.boost = item.boost - old.boost
    } else {
      delete item.boost
    }
  }

  item = { subName, userId: me.id, ...item }
  const fwdUsers = await getForwardUsers(models, forward)

  item = await serializeInvoicable(
    models.$queryRawUnsafe(`${SELECT} FROM update_item($1::JSONB, $2::JSONB, $3::JSONB) AS "Item"`,
      JSON.stringify(item), JSON.stringify(fwdUsers), JSON.stringify(options)),
    { models, lnd, hash, hmac, me }
  )

  await createMentions(item, models)

  item.comments = []
  return item
}

export const createItem = async (parent, { forward, options, ...item }, { me, models, lnd, hash, hmac }) => {
  const spamInterval = me ? ITEM_SPAM_INTERVAL : ANON_ITEM_SPAM_INTERVAL

  // rename to match column name
  item.subName = item.sub
  delete item.sub

  item.userId = me ? Number(me.id) : ANON_USER_ID

  const fwdUsers = await getForwardUsers(models, forward)
  if (item.url && typeof item.maxBid === 'undefined') {
    item.url = ensureProtocol(item.url)
    item.url = removeTracking(item.url)
  }

  const enforceFee = me ? undefined : (item.parentId ? ANON_COMMENT_FEE : (ANON_POST_FEE + (item.boost || 0)))
  item = await serializeInvoicable(
    models.$queryRawUnsafe(
      `${SELECT} FROM create_item($1::JSONB, $2::JSONB, $3::JSONB, '${spamInterval}'::INTERVAL) AS "Item"`,
      JSON.stringify(item), JSON.stringify(fwdUsers), JSON.stringify(options)),
    { models, lnd, hash, hmac, me, enforceFee }
  )

  await createMentions(item, models)

  notifyUserSubscribers({ models, item })

  item.comments = []
  return item
}

const getForwardUsers = async (models, forward) => {
  const fwdUsers = []
  if (forward) {
    // find all users in one db query
    const users = await models.user.findMany({ where: { OR: forward.map(fwd => ({ name: fwd.nym })) } })
    // map users to fwdUser entries with id and pct
    users.forEach(user => {
      fwdUsers.push({
        userId: user.id,
        pct: forward.find(fwd => fwd.nym === user.name).pct
      })
    })
  }
  return fwdUsers
}

// we have to do our own query because ltree is unsupported
export const SELECT =
  `SELECT "Item".id, "Item".created_at, "Item".created_at as "createdAt", "Item".updated_at,
  "Item".updated_at as "updatedAt", "Item".title, "Item".text, "Item".url, "Item"."bounty",
  "Item"."userId", "Item"."parentId", "Item"."pinId", "Item"."maxBid",
  "Item"."rootId", "Item".upvotes, "Item".company, "Item".location, "Item".remote, "Item"."deletedAt",
  "Item"."subName", "Item".status, "Item"."uploadId", "Item"."pollCost", "Item".boost, "Item".msats,
  "Item".ncomments, "Item"."commentMsats", "Item"."lastCommentAt", "Item"."weightedVotes",
  "Item"."weightedDownVotes", "Item".freebie, "Item"."otsHash", "Item"."bountyPaidTo",
  ltree2text("Item"."path") AS "path", "Item"."weightedComments", "Item"."imgproxyUrls"`

async function topOrderByWeightedSats (me, models) {
  return `ORDER BY ${await orderByNumerator(me, models)} DESC NULLS LAST, "Item".id DESC`
}
