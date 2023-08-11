import { GraphQLError } from 'graphql'
import { ensureProtocol, removeTracking } from '../../lib/url'
import serialize from './serial'
import { decodeCursor, LIMIT, nextCursorEncoded } from '../../lib/cursor'
import { getMetadata, metadataRuleSets } from 'page-metadata-parser'
import domino from 'domino'
import {
  BOOST_MIN, ITEM_SPAM_INTERVAL,
  MAX_TITLE_LENGTH, ITEM_FILTER_THRESHOLD,
  DONT_LIKE_THIS_COST, COMMENT_DEPTH_LIMIT, COMMENT_TYPE_QUERY,
  ANON_COMMENT_FEE, ANON_USER_ID, ANON_POST_FEE, ANON_ITEM_SPAM_INTERVAL
} from '../../lib/constants'
import { msatsToSats, numWithUnits } from '../../lib/format'
import { parse } from 'tldts'
import uu from 'url-unshort'
import { amountSchema, bountySchema, commentSchema, discussionSchema, jobSchema, linkSchema, pollSchema, ssValidate } from '../../lib/validate'
import { sendUserNotification } from '../webPush'
import { proxyImages } from './imgproxy'
import { defaultCommentSort } from '../../lib/item'
import { createHmac } from './wallet'

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

async function checkInvoice (models, hash, hmac, fee) {
  if (!hmac) {
    throw new GraphQLError('hmac required', { extensions: { code: 'BAD_INPUT' } })
  }
  const hmac2 = createHmac(hash)
  if (hmac !== hmac2) {
    throw new GraphQLError('bad hmac', { extensions: { code: 'FORBIDDEN' } })
  }

  const invoice = await models.invoice.findUnique({
    where: { hash },
    include: {
      user: true
    }
  })
  if (!invoice) {
    throw new GraphQLError('invoice not found', { extensions: { code: 'BAD_INPUT' } })
  }
  if (!invoice.msatsReceived) {
    throw new GraphQLError('invoice was not paid', { extensions: { code: 'BAD_INPUT' } })
  }
  if (msatsToSats(invoice.msatsReceived) < fee) {
    throw new GraphQLError('invoice amount too low', { extensions: { code: 'BAD_INPUT' } })
  }
  return invoice
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

function whenClause (when, type) {
  let interval = ` AND "${type === 'bookmarks' ? 'Bookmark' : 'Item'}".created_at >= $1 - INTERVAL `
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

const orderByClause = async (by, me, models, type) => {
  switch (by) {
    case 'comments':
      return 'ORDER BY "Item".ncomments DESC'
    case 'sats':
      return 'ORDER BY "Item".msats DESC'
    case 'votes':
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
      return 'JOIN sat_rank_wwm_view ON "Item".id = sat_rank_wwm_view.id'
    }
  }

  return 'JOIN sat_rank_tender_view ON "Item".id = sat_rank_tender_view.id'
}

export async function filterClause (me, models, type) {
  // if you are explicitly asking for marginal content, don't filter them
  if (['outlawed', 'borderland', 'freebies'].includes(type)) {
    if (me && ['outlawed', 'borderland'].includes(type)) {
      // unless the item is mine
      return ` AND "Item"."userId" <> ${me.id} `
    }

    return ''
  }

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

function typeClause (type) {
  switch (type) {
    case 'links':
      return ' AND "Item".url IS NOT NULL AND "Item"."parentId" IS NULL'
    case 'discussions':
      return ' AND "Item".url IS NULL AND "Item".bio = false AND "Item"."pollCost"  IS NULL AND "Item"."parentId" IS NULL'
    case 'polls':
      return ' AND "Item"."pollCost" IS NOT NULL AND "Item"."parentId" IS NULL'
    case 'bios':
      return ' AND "Item".bio = true AND "Item"."parentId" IS NULL'
    case 'bounties':
      return ' AND "Item".bounty IS NOT NULL AND "Item"."parentId" IS NULL'
    case 'comments':
      return ' AND "Item"."parentId" IS NOT NULL'
    case 'freebies':
      return ' AND "Item".freebie'
    case 'outlawed':
      return ` AND "Item"."weightedVotes" - "Item"."weightedDownVotes" <= -${ITEM_FILTER_THRESHOLD}`
    case 'borderland':
      return ' AND "Item"."weightedVotes" - "Item"."weightedDownVotes" < 0 '
    case 'all':
    case 'bookmarks':
      return ''
    case 'jobs':
      return ' AND "Item"."subName" = \'jobs\''
    default:
      return ' AND "Item"."parentId" IS NULL'
  }
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
      SELECT "Item".*, to_json(users.*) as user, COALESCE("ItemAct"."meMsats", 0) as "meMsats",
        COALESCE("ItemAct"."meDontLike", false) as "meDontLike", b."itemId" IS NOT NULL AS "meBookmark",
        "ThreadSubscription"."itemId" IS NOT NULL AS "meSubscription"
      FROM (
        ${query}
      ) "Item"
      JOIN users ON "Item"."userId" = users.id
      LEFT JOIN "Bookmark" b ON b."itemId" = "Item".id AND b."userId" = ${me.id}
      LEFT JOIN "ThreadSubscription" ON "ThreadSubscription"."itemId" = "Item".id AND "ThreadSubscription"."userId" = ${me.id}
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

const subClause = (sub, num, table, solo) => {
  return sub ? ` ${solo ? 'WHERE' : 'AND'} ${table ? `"${table}".` : ''}"subName" = $${num} ` : ''
}

const relationClause = (type) => {
  switch (type) {
    case 'comments':
      return ' FROM "Item" JOIN "Item" root ON "Item"."rootId" = root.id '
    case 'bookmarks':
      return ' FROM "Item" JOIN "Bookmark" ON "Bookmark"."itemId" = "Item"."id" '
    case 'outlawed':
    case 'borderland':
    case 'freebies':
    case 'all':
      return ' FROM "Item" LEFT JOIN "Item" root ON "Item"."rootId" = root.id '
    default:
      return ' FROM "Item" '
  }
}

const selectClause = (type) => type === 'bookmarks'
  ? `${SELECT}, "Bookmark"."created_at" as "bookmarkCreatedAt"`
  : SELECT

const subClauseTable = (type) => COMMENT_TYPE_QUERY.includes(type) ? 'root' : 'Item'

const activeOrMine = (me) => {
  return me ? ` AND ("Item".status <> 'STOPPED' OR "Item"."userId" = ${me.id}) ` : ' AND "Item".status <> \'STOPPED\' '
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

      // HACK we want to optionally include the subName in the query
      // but the query planner doesn't like unused parameters
      const subArr = sub ? [sub] : []

      switch (sort) {
        case 'user':
          if (!name) {
            throw new GraphQLError('must supply name', { extensions: { code: 'BAD_INPUT' } })
          }

          user = await models.user.findUnique({ where: { name } })
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
              WHERE "${table}"."userId" = $2 AND "${table}".created_at <= $1
              ${subClause(sub, 5, subClauseTable(type))}
              ${activeOrMine(me)}
              ${await filterClause(me, models, type)}
              ${typeClause(type)}
              ${whenClause(when || 'forever', type)}
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
              WHERE "Item".created_at <= $1
              ${subClause(sub, 4, subClauseTable(type))}
              ${activeOrMine(me)}
              ${await filterClause(me, models, type)}
              ${typeClause(type)}
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
              WHERE "Item".created_at <= $1
              AND "Item"."pinId" IS NULL AND "Item"."deletedAt" IS NULL
              ${subClause(sub, 4, subClauseTable(type))}
              ${typeClause(type)}
              ${whenClause(when, type)}
              ${await filterClause(me, models, type)}
              ${await orderByClause(by || 'votes', me, models, type)}
              OFFSET $2
              LIMIT $3`,
            orderBy: await orderByClause(by || 'votes', me, models, type)
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
                    WHERE "parentId" IS NULL AND created_at <= $1
                    AND "pinId" IS NULL
                    ${subClause(sub, 4)}
                    AND status IN ('ACTIVE', 'NOSATS')
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
                    ${subClause(sub, 3, 'Item', true)}
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
    upsertLink: async (parent, args, { me, models }) => {
      const { id, ...data } = args
      data.url = ensureProtocol(data.url)
      data.url = removeTracking(data.url)

      await ssValidate(linkSchema, data, models)

      if (id) {
        return await updateItem(parent, { id, data }, { me, models })
      } else {
        return await createItem(parent, data, { me, models, invoiceHash: args.invoiceHash, invoiceHmac: args.invoiceHmac })
      }
    },
    upsertDiscussion: async (parent, args, { me, models }) => {
      const { id, ...data } = args

      await ssValidate(discussionSchema, data, models)

      if (id) {
        return await updateItem(parent, { id, data }, { me, models })
      } else {
        return await createItem(parent, data, { me, models, invoiceHash: args.invoiceHash, invoiceHmac: args.invoiceHmac })
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
      const { sub, forward, boost, title, text, options, invoiceHash, invoiceHmac } = data
      let author = me
      let spamInterval = ITEM_SPAM_INTERVAL
      const trx = []
      if (!me && invoiceHash) {
        const invoice = await checkInvoice(models, invoiceHash, invoiceHmac, ANON_POST_FEE)
        author = invoice.user
        spamInterval = ANON_ITEM_SPAM_INTERVAL
        trx.push(models.invoice.delete({ where: { hash: invoiceHash } }))
      }

      if (!author) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
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
          throw new GraphQLError('forward user does not exist', { extensions: { code: 'BAD_INPUT' } })
        }
      }

      if (id) {
        const old = await models.item.findUnique({ where: { id: Number(id) } })
        if (Number(old.userId) !== Number(author.id)) {
          throw new GraphQLError('item does not belong to you', { extensions: { code: 'FORBIDDEN' } })
        }
        const [item] = await serialize(models,
          models.$queryRawUnsafe(`${SELECT} FROM update_poll($1, $2::INTEGER, $3, $4, $5::INTEGER, $6, $7::INTEGER) AS "Item"`,
            sub || 'bitcoin', Number(id), title, text, Number(boost || 0), options, Number(fwdUser?.id)))

        await createMentions(item, models)
        item.comments = []
        return item
      } else {
        const [query] = await serialize(models,
          models.$queryRawUnsafe(
            `${SELECT} FROM create_poll($1, $2, $3, $4::INTEGER, $5::INTEGER, $6::INTEGER, $7, $8::INTEGER, '${spamInterval}') AS "Item"`,
            sub || 'bitcoin', title, text, 1, Number(boost || 0), Number(author.id), options, Number(fwdUser?.id)), ...trx)
        const item = trx.length > 0 ? query[0] : query

        await createMentions(item, models)
        item.comments = []
        return item
      }
    },
    upsertJob: async (parent, { id, ...data }, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in to create job', { extensions: { code: 'FORBIDDEN' } })
      }
      const { sub, title, company, location, remote, text, url, maxBid, status, logo } = data

      const fullSub = await models.sub.findUnique({ where: { name: sub } })
      if (!fullSub) {
        throw new GraphQLError('not a valid sub', { extensions: { code: 'BAD_INPUT' } })
      }

      await ssValidate(jobSchema, data, models)
      const loc = location.toLowerCase() === 'remote' ? undefined : location

      let item
      if (id) {
        const old = await models.item.findUnique({ where: { id: Number(id) } })
        if (Number(old.userId) !== Number(me?.id)) {
          throw new GraphQLError('item does not belong to you', { extensions: { code: 'FORBIDDEN' } })
        }
        ([item] = await serialize(models,
          models.$queryRawUnsafe(
            `${SELECT} FROM update_job($1::INTEGER, $2, $3, $4, $5::INTEGER, $6, $7, $8, $9::INTEGER, $10::"Status") AS "Item"`,
            Number(id), title, url, text, Number(maxBid), company, loc, remote, Number(logo), status)))
      } else {
        ([item] = await serialize(models,
          models.$queryRawUnsafe(
            `${SELECT} FROM create_job($1, $2, $3, $4::INTEGER, $5::INTEGER, $6, $7, $8, $9::INTEGER) AS "Item"`,
            title, url, text, Number(me.id), Number(maxBid), company, loc, remote, Number(logo))))
      }

      await createMentions(item, models)

      return item
    },
    createComment: async (parent, data, { me, models }) => {
      await ssValidate(commentSchema, data)
      const item = await createItem(parent, data,
        { me, models, invoiceHash: data.invoiceHash, invoiceHmac: data.invoiceHmac })
      // fetch user to get up-to-date name
      const user = await models.user.findUnique({ where: { id: me?.id || ANON_USER_ID } })

      const parents = await models.$queryRawUnsafe(
        'SELECT DISTINCT p."userId" FROM "Item" i JOIN "Item" p ON p.path @> i.path WHERE i.id = $1 and p."userId" <> $2',
        Number(item.parentId), Number(user.id))
      Promise.allSettled(
        parents.map(({ userId }) => sendUserNotification(userId, {
          title: `@${user.name} replied to you`,
          body: data.text,
          item,
          tag: 'REPLY'
        }))
      )

      return item
    },
    updateComment: async (parent, { id, ...data }, { me, models }) => {
      await ssValidate(commentSchema, data)
      return await updateItem(parent, { id, data }, { me, models })
    },
    pollVote: async (parent, { id }, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
      }

      await serialize(models,
        models.$queryRawUnsafe(`${SELECT} FROM poll_vote($1::INTEGER, $2::INTEGER) AS "Item"`,
          Number(id), Number(me.id)))

      return id
    },
    act: async (parent, { id, sats, invoiceHash, invoiceHmac }, { me, models }) => {
      // need to make sure we are logged in
      if (!me && !invoiceHash) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
      }

      await ssValidate(amountSchema, { amount: sats })

      let user = me
      let invoice
      if (!me && invoiceHash) {
        invoice = await checkInvoice(models, invoiceHash, invoiceHmac, sats)
        user = invoice.user
      }

      // disallow self tips except anons
      if (user.id !== ANON_USER_ID) {
        const [item] = await models.$queryRawUnsafe(`
        ${SELECT}
        FROM "Item"
        WHERE id = $1 AND "userId" = $2`, Number(id), user.id)
        if (item) {
          throw new GraphQLError('cannot zap your self', { extensions: { code: 'BAD_INPUT' } })
        }
      }

      const calls = [
        models.$queryRaw`SELECT item_act(${Number(id)}::INTEGER, ${user.id}::INTEGER, 'TIP', ${Number(sats)}::INTEGER)`
      ]
      if (invoice) {
        calls.push(models.invoice.delete({ where: { hash: invoice.hash } }))
      }

      const [{ item_act: vote }] = await serialize(models, ...calls)

      const updatedItem = await models.item.findUnique({ where: { id: Number(id) } })
      const title = `your ${updatedItem.title ? 'post' : 'reply'} ${updatedItem.fwdUser ? 'forwarded' : 'stacked'} ${
        numWithUnits(msatsToSats(updatedItem.msats))}${updatedItem.fwdUser ? ` to @${updatedItem.fwdUser.name}` : ''}`
      sendUserNotification(updatedItem.userId, {
        title,
        body: updatedItem.title ? updatedItem.title : updatedItem.text,
        item: updatedItem,
        tag: `TIP-${updatedItem.id}`
      }).catch(console.error)

      return {
        vote,
        sats
      }
    },
    dontLikeThis: async (parent, { id }, { me, models }) => {
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

      await serialize(models, models.$queryRaw`SELECT item_act(${Number(id)}::INTEGER,
        ${me.id}::INTEGER, 'DONT_LIKE_THIS', ${DONT_LIKE_THIS_COST}::INTEGER)`)

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
    fwdUser: async (item, args, { models }) => {
      if (!item.fwdUserId) {
        return null
      }
      return await models.user.findUnique({ where: { id: item.fwdUserId } })
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

export const updateItem = async (parent, { id, data: { sub, title, url, text, boost, forward, bounty, parentId } }, { me, models }) => {
  // update iff this item belongs to me
  const old = await models.item.findUnique({ where: { id: Number(id) } })
  if (Number(old.userId) !== Number(me?.id)) {
    throw new GraphQLError('item does not belong to you', { extensions: { code: 'FORBIDDEN' } })
  }

  // if it's not the FAQ, not their bio, and older than 10 minutes
  const user = await models.user.findUnique({ where: { id: me.id } })
  if (![349, 76894, 78763, 81862].includes(old.id) && user.bioId !== id && Date.now() > new Date(old.createdAt).getTime() + 10 * 60000) {
    throw new GraphQLError('item can no longer be editted', { extensions: { code: 'BAD_INPUT' } })
  }

  if (boost && boost < BOOST_MIN) {
    throw new GraphQLError(`boost must be at least ${BOOST_MIN}`, { extensions: { code: 'BAD_INPUT' } })
  }

  if (!old.parentId && title.length > MAX_TITLE_LENGTH) {
    throw new GraphQLError('title too long', { extensions: { code: 'BAD_INPUT' } })
  }

  let fwdUser
  if (forward) {
    fwdUser = await models.user.findUnique({ where: { name: forward } })
    if (!fwdUser) {
      throw new GraphQLError('forward user does not exist', { extensions: { code: 'BAD_INPUT' } })
    }
  }

  url = await proxyImages(url)
  text = await proxyImages(text)

  const [item] = await serialize(models,
    models.$queryRawUnsafe(
      `${SELECT} FROM update_item($1, $2::INTEGER, $3, $4, $5, $6::INTEGER, $7::INTEGER, $8::INTEGER) AS "Item"`,
      old.parentId ? null : sub || 'bitcoin', Number(id), title, url, text,
      Number(boost || 0), bounty ? Number(bounty) : null, Number(fwdUser?.id)))

  await createMentions(item, models)

  return item
}

const createItem = async (parent, { sub, title, url, text, boost, forward, bounty, parentId }, { me, models, invoiceHash, invoiceHmac }) => {
  let author = me
  let spamInterval = ITEM_SPAM_INTERVAL
  const trx = []
  if (!me && invoiceHash) {
    const invoice = await checkInvoice(models, invoiceHash, invoiceHmac, parentId ? ANON_COMMENT_FEE : ANON_POST_FEE)
    author = invoice.user
    spamInterval = ANON_ITEM_SPAM_INTERVAL
    trx.push(models.invoice.delete({ where: { hash: invoiceHash } }))
  }

  if (!author) {
    throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
  }

  if (boost && boost < BOOST_MIN) {
    throw new GraphQLError(`boost must be at least ${BOOST_MIN}`, { extensions: { code: 'BAD_INPUT' } })
  }

  if (!parentId && title.length > MAX_TITLE_LENGTH) {
    throw new GraphQLError('title too long', { extensions: { code: 'BAD_INPUT' } })
  }

  let fwdUser
  if (forward) {
    fwdUser = await models.user.findUnique({ where: { name: forward } })
    if (!fwdUser) {
      throw new GraphQLError('forward user does not exist', { extensions: { code: 'BAD_INPUT' } })
    }
  }

  url = await proxyImages(url)
  text = await proxyImages(text)

  const [query] = await serialize(
    models,
    models.$queryRawUnsafe(
    `${SELECT} FROM create_item($1, $2, $3, $4, $5::INTEGER, $6::INTEGER, $7::INTEGER, $8::INTEGER, $9::INTEGER, '${spamInterval}') AS "Item"`,
    parentId ? null : sub || 'bitcoin',
    title,
    url,
    text,
    Number(boost || 0),
    bounty ? Number(bounty) : null,
    Number(parentId),
    Number(author.id),
    Number(fwdUser?.id)),
    ...trx)
  const item = trx.length > 0 ? query[0] : query

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

async function topOrderByWeightedSats (me, models) {
  return `ORDER BY ${await orderByNumerator(me, models)} DESC NULLS LAST, "Item".id DESC`
}
