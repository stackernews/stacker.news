import { GraphQLError } from 'graphql'
import { ensureProtocol, removeTracking, stripTrailingSlash } from '@/lib/url'
import { decodeCursor, LIMIT, nextCursorEncoded } from '@/lib/cursor'
import { getMetadata, metadataRuleSets } from 'page-metadata-parser'
import { ruleSet as publicationDateRuleSet } from '@/lib/timedate-scraper'
import domino from 'domino'
import {
  ITEM_SPAM_INTERVAL, ITEM_FILTER_THRESHOLD,
  COMMENT_DEPTH_LIMIT, COMMENT_TYPE_QUERY,
  USER_ID, POLL_COST,
  ITEM_ALLOW_EDITS, GLOBAL_SEED, NOFOLLOW_LIMIT, UNKNOWN_LINK_REL, SN_USER_IDS
} from '@/lib/constants'
import { msatsToSats } from '@/lib/format'
import { parse } from 'tldts'
import uu from 'url-unshort'
import { actSchema, advSchema, bountySchema, commentSchema, discussionSchema, jobSchema, linkSchema, pollSchema, ssValidate } from '@/lib/validate'
import { defaultCommentSort, isJob, deleteItemByAuthor } from '@/lib/item'
import { datePivot, whenRange } from '@/lib/time'
import { uploadIdsFromText } from './image'
import assertGofacYourself from './ofac'
import assertApiKeyNotPermitted from './apiKey'
import performPaidAction from '../paidAction'

function commentsOrderByClause (me, models, sort) {
  if (sort === 'recent') {
    return 'ORDER BY "Item".created_at DESC, "Item".id DESC'
  }

  if (me && sort === 'hot') {
    return `ORDER BY COALESCE(
        personal_hot_score,
        ${orderByNumerator(models, 0)}/POWER(GREATEST(3, EXTRACT(EPOCH FROM (now_utc() - "Item".created_at))/3600), 1.3)) DESC NULLS LAST,
        "Item".msats DESC, ("Item".freebie IS FALSE) DESC, "Item".id DESC`
  } else {
    if (sort === 'top') {
      return `ORDER BY ${orderByNumerator(models, 0)} DESC NULLS LAST, "Item".msats DESC, ("Item".freebie IS FALSE) DESC,  "Item".id DESC`
    } else {
      return `ORDER BY ${orderByNumerator(models, 0)}/POWER(GREATEST(3, EXTRACT(EPOCH FROM (now_utc() - "Item".created_at))/3600), 1.3) DESC NULLS LAST, "Item".msats DESC, ("Item".freebie IS FALSE) DESC, "Item".id DESC`
    }
  }
}

async function comments (me, models, id, sort) {
  const orderBy = commentsOrderByClause(me, models, sort)

  if (me) {
    const filter = ` AND ("Item"."invoiceActionState" IS NULL OR "Item"."invoiceActionState" = 'PAID' OR "Item"."userId" = ${me.id}) `
    const [{ item_comments_zaprank_with_me: comments }] = await models.$queryRawUnsafe(
      'SELECT item_comments_zaprank_with_me($1::INTEGER, $2::INTEGER, $3::INTEGER, $4::INTEGER, $5, $6)',
      Number(id), GLOBAL_SEED, Number(me.id), COMMENT_DEPTH_LIMIT, filter, orderBy)
    return comments
  }

  const filter = ' AND ("Item"."invoiceActionState" IS NULL OR "Item"."invoiceActionState" = \'PAID\') '
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
      ${whereClause(
        '"Item".id = $1',
        activeOrMine(me)
      )}`
  }, Number(id))
  return item
}

const orderByClause = (by, me, models, type) => {
  switch (by) {
    case 'comments':
      return 'ORDER BY "Item".ncomments DESC'
    case 'sats':
      return 'ORDER BY "Item".msats DESC'
    case 'zaprank':
      return topOrderByWeightedSats(me, models)
    default:
      return `ORDER BY ${type === 'bookmarks' ? '"bookmarkCreatedAt"' : '"Item".created_at'} DESC`
  }
}

export function orderByNumerator (models, commentScaler = 0.5) {
  return `(CASE WHEN "Item"."weightedVotes" - "Item"."weightedDownVotes" > 0 THEN
              GREATEST("Item"."weightedVotes" - "Item"."weightedDownVotes", POWER("Item"."weightedVotes" - "Item"."weightedDownVotes", 1.2))
            ELSE
              "Item"."weightedVotes" - "Item"."weightedDownVotes"
            END + "Item"."weightedComments"*${commentScaler})`
}

export function joinZapRankPersonalView (me, models) {
  let join = ` JOIN zap_rank_personal_view g ON g.id = "Item".id AND g."viewerId" = ${GLOBAL_SEED} `

  if (me) {
    join += ` LEFT JOIN zap_rank_personal_view l ON l.id = g.id AND l."viewerId" = ${me.id} `
  }

  return join
}

// this grabs all the stuff we need to display the item list and only
// hits the db once ... orderBy needs to be duplicated on the outer query because
// joining does not preserve the order of the inner query
export async function itemQueryWithMeta ({ me, models, query, orderBy = '' }, ...args) {
  if (!me) {
    return await models.$queryRawUnsafe(`
      SELECT "Item".*, to_json(users.*) as user, to_jsonb("Sub".*) as sub
      FROM (
        ${query}
      ) "Item"
      JOIN users ON "Item"."userId" = users.id
      LEFT JOIN "Sub" ON "Sub"."name" = "Item"."subName"
      ${orderBy}`, ...args)
  } else {
    return await models.$queryRawUnsafe(`
      SELECT "Item".*, to_jsonb(users.*) || jsonb_build_object('meMute', "Mute"."mutedId" IS NOT NULL) as user,
        COALESCE("ItemAct"."meMsats", 0) as "meMsats", COALESCE("ItemAct"."mePendingMsats", 0) as "mePendingMsats",
        COALESCE("ItemAct"."meDontLikeMsats", 0) as "meDontLikeMsats", b."itemId" IS NOT NULL AS "meBookmark",
        "ThreadSubscription"."itemId" IS NOT NULL AS "meSubscription", "ItemForward"."itemId" IS NOT NULL AS "meForward",
        to_jsonb("Sub".*) || jsonb_build_object('meMuteSub', "MuteSub"."userId" IS NOT NULL)
        || jsonb_build_object('meSubscription', "SubSubscription"."userId" IS NOT NULL) as sub
      FROM (
        ${query}
      ) "Item"
      JOIN users ON "Item"."userId" = users.id
      LEFT JOIN "Mute" ON "Mute"."muterId" = ${me.id} AND "Mute"."mutedId" = "Item"."userId"
      LEFT JOIN "Bookmark" b ON b."itemId" = "Item".id AND b."userId" = ${me.id}
      LEFT JOIN "ThreadSubscription" ON "ThreadSubscription"."itemId" = "Item".id AND "ThreadSubscription"."userId" = ${me.id}
      LEFT JOIN "ItemForward" ON "ItemForward"."itemId" = "Item".id AND "ItemForward"."userId" = ${me.id}
      LEFT JOIN "Sub" ON "Sub"."name" = "Item"."subName"
      LEFT JOIN "MuteSub" ON "Sub"."name" = "MuteSub"."subName" AND "MuteSub"."userId" = ${me.id}
      LEFT JOIN "SubSubscription" ON "Sub"."name" = "SubSubscription"."subName" AND "SubSubscription"."userId" = ${me.id}
      LEFT JOIN LATERAL (
        SELECT "itemId",
          sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS DISTINCT FROM 'FAILED' AND (act = 'FEE' OR act = 'TIP')) AS "meMsats",
          sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS NOT DISTINCT FROM 'PENDING' AND (act = 'FEE' OR act = 'TIP') AND "Item"."userId" <> ${me.id}) AS "mePendingMsats",
          sum("ItemAct".msats) FILTER (WHERE "invoiceActionState" IS DISTINCT FROM 'FAILED' AND act = 'DONT_LIKE_THIS') AS "meDontLikeMsats"
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
      clause += ' FROM "Item" JOIN "Item" root ON "Item"."rootId" = root.id LEFT JOIN "Sub" ON "Sub"."name" = root."subName" '
      break
    case 'bookmarks':
      clause += ' FROM "Item" JOIN "Bookmark" ON "Bookmark"."itemId" = "Item"."id" LEFT JOIN "Item" root ON "Item"."rootId" = root.id LEFT JOIN "Sub" ON "Sub"."name" = COALESCE(root."subName", "Item"."subName") '
      break
    case 'outlawed':
    case 'borderland':
    case 'freebies':
    case 'all':
      clause += ' FROM "Item" LEFT JOIN "Item" root ON "Item"."rootId" = root.id LEFT JOIN "Sub" ON "Sub"."name" = COALESCE(root."subName", "Item"."subName") '
      break
    default:
      clause += ' FROM "Item" LEFT JOIN "Sub" ON "Sub"."name" = "Item"."subName" '
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

function whenClause (when, table) {
  return `"${table}".created_at <= $2 and "${table}".created_at >= $1`
}

export const activeOrMine = (me) => {
  return me
    ? [`("Item"."invoiceActionState" IS NULL OR "Item"."invoiceActionState" = 'PAID' OR "Item"."userId" = ${me.id})`,
    `("Item".status <> 'STOPPED' OR "Item"."userId" = ${me.id})`]
    : ['("Item"."invoiceActionState" IS NULL OR "Item"."invoiceActionState" = \'PAID\')', '"Item".status <> \'STOPPED\'']
}

export const muteClause = me =>
  me ? `NOT EXISTS (SELECT 1 FROM "Mute" WHERE "Mute"."muterId" = ${me.id} AND "Mute"."mutedId" = "Item"."userId")` : ''

const HIDE_NSFW_CLAUSE = '("Sub"."nsfw" = FALSE OR "Sub"."nsfw" IS NULL)'

export const nsfwClause = showNsfw => showNsfw ? '' : HIDE_NSFW_CLAUSE

const subClause = (sub, num, table, me, showNsfw) => {
  // Intentionally show nsfw posts (i.e. no nsfw clause) when viewing a specific nsfw sub
  if (sub) { return `${table ? `"${table}".` : ''}"subName" = $${num}::CITEXT` }

  if (!me) { return HIDE_NSFW_CLAUSE }

  const excludeMuted = `NOT EXISTS (SELECT 1 FROM "MuteSub" WHERE "MuteSub"."userId" = ${me.id} AND "MuteSub"."subName" = ${table ? `"${table}".` : ''}"subName")`
  if (showNsfw) return excludeMuted

  return excludeMuted + ' AND ' + HIDE_NSFW_CLAUSE
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
  const outlawClauses = [`"Item"."weightedVotes" - "Item"."weightedDownVotes" > -${ITEM_FILTER_THRESHOLD} AND NOT "Item".outlawed`]
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
      return `"Item"."weightedVotes" - "Item"."weightedDownVotes" <= -${ITEM_FILTER_THRESHOLD} OR "Item".outlawed`
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
    items: async (parent, { sub, sort, type, cursor, name, when, from, to, by, limit = LIMIT }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      let items, user, pins, subFull, table

      // special authorization for bookmarks depending on owning users' privacy settings
      if (type === 'bookmarks' && name && me?.name !== name) {
        // the calling user is either not logged in, or not the user upon which the query is made,
        // so we need to check authz
        user = await models.user.findUnique({ where: { name } })
        // additionally check if the user ids are not the same since if the nym changed
        // since the last session update we would hide bookmarks from their owners
        // see https://github.com/stackernews/stacker.news/issues/586
        if (user?.hideBookmarks && user.id !== me.id) {
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

      const currentUser = me ? await models.user.findUnique({ where: { id: me.id } }) : null
      const showNsfw = currentUser ? currentUser.nsfwMode : false

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
                `"${table}"."userId" = $3`,
                activeOrMine(me),
                await filterClause(me, models, type),
                nsfwClause(showNsfw),
                typeClause(type),
                whenClause(when || 'forever', table))}
              ${orderByClause(by, me, models, type)}
              OFFSET $4
              LIMIT $5`,
            orderBy: orderByClause(by, me, models, type)
          }, ...whenRange(when, from, to || decodedCursor.time), user.id, decodedCursor.offset, limit)
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
                subClause(sub, 4, subClauseTable(type), me, showNsfw),
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
                '"Item"."deletedAt" IS NULL',
                type === 'posts' && '"Item"."subName" IS NOT NULL',
                subClause(sub, 5, subClauseTable(type), me, showNsfw),
                typeClause(type),
                whenClause(when, 'Item'),
                await filterClause(me, models, type),
                muteClause(me))}
              ${orderByClause(by || 'zaprank', me, models, type)}
              OFFSET $3
              LIMIT $4`,
            orderBy: orderByClause(by || 'zaprank', me, models, type)
          }, ...whenRange(when, from, to || decodedCursor.time), decodedCursor.offset, limit, ...subArr)
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
                    ${SELECT}, ${me ? 'GREATEST(g.tf_hot_score, l.tf_hot_score)' : 'g.tf_hot_score'} AS rank
                    FROM "Item"
                    LEFT JOIN "Sub" ON "Sub"."name" = "Item"."subName"
                    ${joinZapRankPersonalView(me, models)}
                    ${whereClause(
                      // in "home" (sub undefined), we want to show pinned items (but without the pin icon)
                      sub ? '"Item"."pinId" IS NULL' : '',
                      '"Item"."deletedAt" IS NULL',
                      '"Item"."parentId" IS NULL',
                      '"Item".bio = false',
                      activeOrMine(me),
                      subClause(sub, 3, 'Item', me, showNsfw),
                      muteClause(me))}
                    ORDER BY rank DESC
                    OFFSET $1
                    LIMIT $2`,
                orderBy: 'ORDER BY rank DESC'
              }, decodedCursor.offset, limit, ...subArr)

              // XXX this is just for subs that are really empty
              if (decodedCursor.offset === 0 && items.length < limit) {
                items = await itemQueryWithMeta({
                  me,
                  models,
                  query: `
                      ${SELECT}
                      FROM "Item"
                      LEFT JOIN "Sub" ON "Sub"."name" = "Item"."subName"
                      ${whereClause(
                        subClause(sub, 3, 'Item', me, showNsfw),
                        muteClause(me),
                        // in "home" (sub undefined), we want to show pinned items (but without the pin icon)
                        sub ? '"Item"."pinId" IS NULL' : '',
                        '"Item"."deletedAt" IS NULL',
                        '"Item"."parentId" IS NULL',
                        '"Item".bio = false',
                        activeOrMine(me),
                        await filterClause(me, models, type))}
                        ORDER BY ${orderByNumerator(models, 0)}/POWER(GREATEST(3, EXTRACT(EPOCH FROM (now_utc() - "Item".created_at))/3600), 1.3) DESC NULLS LAST, "Item".msats DESC, ("Item".freebie IS FALSE) DESC, "Item".id DESC
                      OFFSET $1
                      LIMIT $2`,
                  orderBy: `ORDER BY ${orderByNumerator(models, 0)}/POWER(GREATEST(3, EXTRACT(EPOCH FROM (now_utc() - "Item".created_at))/3600), 1.3) DESC NULLS LAST, "Item".msats DESC, ("Item".freebie IS FALSE) DESC, "Item".id DESC`
                }, decodedCursor.offset, limit, ...subArr)
              }

              if (decodedCursor.offset === 0) {
                // get pins for the page and return those separately
                pins = await itemQueryWithMeta({
                  me,
                  models,
                  query: `
                    SELECT rank_filter.*
                      FROM (
                        ${SELECT}, position,
                        rank() OVER (
                            PARTITION BY "pinId"
                            ORDER BY "Item".created_at DESC
                        )
                        FROM "Item"
                        JOIN "Pin" ON "Item"."pinId" = "Pin".id
                        ${whereClause(
                          '"pinId" IS NOT NULL',
                          '"parentId" IS NULL',
                          sub ? '"subName" = $1' : '"subName" IS NULL',
                          muteClause(me))}
                    ) rank_filter WHERE RANK = 1
                    ORDER BY position ASC`,
                  orderBy: 'ORDER BY position ASC'
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
        const metadata = getMetadata(doc, url, { title: metadataRuleSets.title, publicationDate: publicationDateRuleSet })
        const dateHint = ` (${metadata.publicationDate?.getFullYear()})`
        const moreThanOneYearAgo = metadata.publicationDate && metadata.publicationDate < datePivot(new Date(), { years: -1 })

        res.title = metadata?.title
        if (moreThanOneYearAgo) res.title += dateHint
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
      const { hostname, pathname } = urlObj

      let hostnameRegex = hostname + '(:[0-9]+)?'
      const parseResult = parse(urlObj.hostname)
      if (parseResult?.subdomain?.length) {
        const { subdomain } = parseResult
        hostnameRegex = hostnameRegex.replace(subdomain, '(%)?')
      } else {
        hostnameRegex = `(%.)?${hostnameRegex}`
      }

      // escape postgres regex meta characters
      let pathnameRegex = pathname.replace(/\+/g, '\\+')
      pathnameRegex = pathnameRegex.replace(/%/g, '\\%')
      pathnameRegex = pathnameRegex.replace(/_/g, '\\_')

      const uriRegex = stripTrailingSlash(hostnameRegex + pathnameRegex)

      let similar = `(http(s)?://)?${uriRegex}/?`
      const whitelist = ['news.ycombinator.com/item', 'bitcointalk.org/index.php']
      const youtube = ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be']

      const hostAndPath = stripTrailingSlash(urlObj.hostname + urlObj.pathname)
      if (whitelist.includes(hostAndPath)) {
        similar += `\\${urlObj.search}`
      } else if (youtube.includes(urlObj.hostname)) {
        // extract id and create both links
        const matches = url.match(/(https?:\/\/)?((www\.)?(youtube(-nocookie)?|youtube.googleapis)\.com.*(v\/|v=|vi=|vi\/|e\/|embed\/|user\/.*\/u\/\d+\/)|youtu\.be\/)(?<id>[_0-9a-z-]+)/i)
        similar = `(http(s)?://)?((www.|m.)?youtube.com/(watch\\?v=|v/|live/)${matches?.groups?.id}|youtu.be/${matches?.groups?.id})((\\?|&|#)%)?`
      } else if (urlObj.hostname === 'yewtu.be') {
        const matches = url.match(/(https?:\/\/)?yewtu\.be.*(v=|embed\/)(?<id>[_0-9a-z-]+)/i)
        similar = `(http(s)?://)?yewtu.be/(watch\\?v=|embed/)${matches?.groups?.id}((\\?|&|#)%)?`
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
    pinItem: async (parent, { id }, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
      }

      const [item] = await models.$queryRawUnsafe(
        `${SELECT}, p.position
        FROM "Item" LEFT JOIN "Pin" p ON p.id = "Item"."pinId"
        WHERE "Item".id = $1`, Number(id))

      const args = []
      if (item.parentId) {
        args.push(item.parentId)

        // OPs can only pin top level replies
        if (item.path.split('.').length > 2) {
          throw new GraphQLError('can only pin root replies', { extensions: { code: 'FORBIDDEN' } })
        }

        const root = await models.item.findUnique({
          where: {
            id: Number(item.parentId)
          },
          include: { pin: true }
        })

        if (root.userId !== Number(me.id)) {
          throw new GraphQLError('not your post', { extensions: { code: 'FORBIDDEN' } })
        }
      } else if (item.subName) {
        args.push(item.subName)

        // only territory founder can pin posts
        const sub = await models.sub.findUnique({ where: { name: item.subName } })
        if (Number(me.id) !== sub.userId) {
          throw new GraphQLError('not your sub', { extensions: { code: 'FORBIDDEN' } })
        }
      } else {
        throw new GraphQLError('item must have subName or parentId', { extensions: { code: 'BAD_INPUT' } })
      }

      let pinId
      if (item.pinId) {
        // item is already pinned. remove pin
        await models.$transaction([
          models.item.update({ where: { id: item.id }, data: { pinId: null } }),
          models.pin.delete({ where: { id: item.pinId } }),
          // make sure that pins have no gaps
          models.$queryRawUnsafe(`
            UPDATE "Pin"
            SET position = position - 1
            WHERE position > $2 AND id IN (
              SELECT "pinId" FROM "Item" i
              ${whereClause('"pinId" IS NOT NULL', item.subName ? 'i."subName" = $1' : 'i."parentId" = $1')}
            )`, ...args, item.position)
        ])

        pinId = null
      } else {
        // only max 3 pins allowed per territory and post
        const [{ count: npins }] = await models.$queryRawUnsafe(`
          SELECT COUNT(p.id) FROM "Pin" p
          JOIN "Item" i ON i."pinId" = p.id
          ${
            whereClause(item.subName ? 'i."subName" = $1' : 'i."parentId" = $1')
          }`, ...args)

        if (npins >= 3) {
          throw new GraphQLError('max 3 pins allowed', { extensions: { code: 'FORBIDDEN' } })
        }

        const [{ pinId: newPinId }] = await models.$queryRawUnsafe(`
          WITH pin AS (
            INSERT INTO "Pin" (position)
            SELECT COALESCE(MAX(p.position), 0) + 1 AS position
            FROM "Pin" p
            JOIN "Item" i ON i."pinId" = p.id
            ${whereClause(item.subName ? 'i."subName" = $1' : 'i."parentId" = $1')}
            RETURNING id
          )
          UPDATE "Item"
          SET "pinId" = pin.id
          FROM pin
          WHERE "Item".id = $2
          RETURNING "pinId"`, ...args, item.id)

        pinId = newPinId
      }

      return { id, pinId }
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
      if (old.bio) {
        throw new GraphQLError('cannot delete bio', { extensions: { code: 'BAD_INPUT' } })
      }

      return await deleteItemByAuthor({ models, id, item: old })
    },
    upsertLink: async (parent, { id, ...item }, { me, models, lnd }) => {
      await ssValidate(linkSchema, item, { models, me })

      if (id) {
        return await updateItem(parent, { id, ...item }, { me, models, lnd })
      } else {
        return await createItem(parent, item, { me, models, lnd })
      }
    },
    upsertDiscussion: async (parent, { id, ...item }, { me, models, lnd }) => {
      await ssValidate(discussionSchema, item, { models, me })

      if (id) {
        return await updateItem(parent, { id, ...item }, { me, models, lnd })
      } else {
        return await createItem(parent, item, { me, models, lnd })
      }
    },
    upsertBounty: async (parent, { id, ...item }, { me, models, lnd }) => {
      await ssValidate(bountySchema, item, { models, me })

      if (id) {
        return await updateItem(parent, { id, ...item }, { me, models, lnd })
      } else {
        return await createItem(parent, item, { me, models, lnd })
      }
    },
    upsertPoll: async (parent, { id, ...item }, { me, models, lnd }) => {
      const numExistingChoices = id
        ? await models.pollOption.count({
          where: {
            itemId: Number(id)
          }
        })
        : 0

      await ssValidate(pollSchema, item, { models, me, numExistingChoices })

      if (id) {
        return await updateItem(parent, { id, ...item }, { me, models, lnd })
      } else {
        item.pollCost = item.pollCost || POLL_COST
        return await createItem(parent, item, { me, models, lnd })
      }
    },
    upsertJob: async (parent, { id, ...item }, { me, models, lnd }) => {
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
        return await updateItem(parent, { id, ...item }, { me, models, lnd })
      } else {
        return await createItem(parent, item, { me, models, lnd })
      }
    },
    upsertComment: async (parent, { id, ...item }, { me, models, lnd }) => {
      await ssValidate(commentSchema, item)

      if (id) {
        return await updateItem(parent, { id, ...item }, { me, models, lnd })
      } else {
        item = await createItem(parent, item, { me, models, lnd })
        return item
      }
    },
    updateNoteId: async (parent, { id, noteId }, { me, models }) => {
      if (!id) {
        throw new GraphQLError('id required', { extensions: { code: 'BAD_INPUT' } })
      }

      await models.item.update({
        where: { id: Number(id), userId: Number(me.id) },
        data: { noteId }
      })

      return { id, noteId }
    },
    pollVote: async (parent, { id }, { me, models, lnd }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
      }

      return await performPaidAction('POLL_VOTE', { id }, { me, models, lnd })
    },
    act: async (parent, { id, sats, act = 'TIP', idempotent }, { me, models, lnd, headers }) => {
      assertApiKeyNotPermitted({ me })
      await ssValidate(actSchema, { sats, act })
      await assertGofacYourself({ models, headers })

      const [item] = await models.$queryRawUnsafe(`
        ${SELECT}
        FROM "Item"
        WHERE id = $1`, Number(id))

      if (item.deletedAt) {
        throw new GraphQLError('item is deleted', { extensions: { code: 'BAD_INPUT' } })
      }

      if (item.invoiceActionState && item.invoiceActionState !== 'PAID') {
        throw new GraphQLError('cannot act on unpaid item', { extensions: { code: 'BAD_INPUT' } })
      }

      // disallow self tips except anons
      if (me) {
        if (Number(item.userId) === Number(me.id)) {
          throw new GraphQLError('cannot zap your self', { extensions: { code: 'BAD_INPUT' } })
        }

        // Disallow tips if me is one of the forward user recipients
        if (act === 'TIP') {
          const existingForwards = await models.itemForward.findMany({ where: { itemId: Number(id) } })
          if (existingForwards.some(fwd => Number(fwd.userId) === Number(me.id))) {
            throw new GraphQLError('cannot zap a post for which you are forwarded zaps', { extensions: { code: 'BAD_INPUT' } })
          }
        }
      }

      if (act === 'TIP') {
        return await performPaidAction('ZAP', { id, sats }, { me, models, lnd })
      } else if (act === 'DONT_LIKE_THIS') {
        return await performPaidAction('DOWN_ZAP', { id, sats }, { me, models, lnd })
      } else {
        throw new GraphQLError('unknown act', { extensions: { code: 'BAD_INPUT' } })
      }
    },
    toggleOutlaw: async (parent, { id }, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
      }

      const item = await models.item.findUnique({
        where: { id: Number(id) },
        include: {
          sub: true,
          root: {
            include: {
              sub: true
            }
          }
        }
      })

      const sub = item.sub || item.root?.sub

      if (Number(sub.userId) !== Number(me.id)) {
        throw new GraphQLError('you cant do this broh', { extensions: { code: 'FORBIDDEN' } })
      }

      if (item.outlawed) {
        return item
      }

      const [result] = await models.$transaction(
        [
          models.item.update({
            where: {
              id: Number(id)
            },
            data: {
              outlawed: true
            }
          }),
          models.sub.update({
            where: {
              name: sub.name
            },
            data: {
              moderatedCount: {
                increment: 1
              }
            }
          })
        ])

      return result
    }
  },
  ItemAct: {
    invoice: async (itemAct, args, { models }) => {
      if (itemAct.invoiceId) {
        return {
          id: itemAct.invoiceId,
          actionState: itemAct.invoiceActionState
        }
      }
      return null
    }
  },
  Item: {
    sats: async (item, args, { models }) => {
      return msatsToSats(BigInt(item.msats) + BigInt(item.mePendingMsats || 0))
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

      if (item.sub) {
        return item.sub
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
        SELECT "PollOption".id, option,
          (count("PollVote".id)
            FILTER(WHERE "PollVote"."invoiceActionState" IS NULL
              OR "PollVote"."invoiceActionState" = 'PAID'))::INTEGER as count
        FROM "PollOption"
        LEFT JOIN "PollVote" on "PollVote"."pollOptionId" = "PollOption".id
        WHERE "PollOption"."itemId" = ${item.id}
        GROUP BY "PollOption".id
        ORDER BY "PollOption".id ASC
      `

      const poll = {}
      if (me) {
        const meVoted = await models.pollBlindVote.findFirst({
          where: {
            userId: me.id,
            itemId: item.id
          }
        })
        poll.meVoted = !!meVoted
        poll.meInvoiceId = meVoted?.invoiceId
        poll.meInvoiceActionState = meVoted?.invoiceActionState
      } else {
        poll.meVoted = false
      }

      poll.options = options
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
    freedFreebie: async (item) => {
      return item.weightedVotes - item.weightedDownVotes > 0
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
          invoiceActionState: {
            not: 'FAILED'
          },
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
    meDontLikeSats: async (item, args, { me, models }) => {
      if (!me) return 0
      if (typeof item.meDontLikeMsats !== 'undefined') {
        return msatsToSats(item.meDontLikeMsats)
      }

      const { _sum: { msats } } = await models.itemAct.aggregate({
        _sum: {
          msats: true
        },
        where: {
          itemId: Number(item.id),
          userId: me.id,
          act: 'DONT_LIKE_THIS',
          invoiceActionState: {
            not: 'FAILED'
          }
        }
      })

      return (msats && msatsToSats(msats)) || 0
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
      return item.outlawed || item.weightedVotes - item.weightedDownVotes <= -ITEM_FILTER_THRESHOLD
    },
    rel: async (item, args, { me, models }) => {
      const sats = item.msats ? msatsToSats(item.msats) : 0
      const boost = item.boost ?? 0
      return (sats + boost < NOFOLLOW_LIMIT) ? UNKNOWN_LINK_REL : 'noopener noreferrer'
    },
    mine: async (item, args, { me, models }) => {
      return me?.id === item.userId
    },
    root: async (item, args, { models, me }) => {
      if (!item.rootId) {
        return null
      }
      if (item.root) {
        return item.root
      }

      // we can't use getItem because activeOrMine will prevent root from being fetched
      const [root] = await itemQueryWithMeta({
        me,
        models,
        query: `
          ${SELECT}
          FROM "Item"
          ${whereClause(
            '"Item".id = $1',
            `("Item"."invoiceActionState" IS NULL OR "Item"."invoiceActionState" = 'PAID'${me ? ` OR "Item"."userId" = ${me.id}` : ''})`
          )}`
      }, Number(item.rootId))

      return root
    },
    invoice: async (item, args, { models }) => {
      if (item.invoiceId) {
        return {
          id: item.invoiceId,
          actionState: item.invoiceActionState,
          confirmedAt: item.invoicePaidAtUTC ?? item.invoicePaidAt
        }
      }

      return null
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
    },
    deleteScheduledAt: async (item, args, { me, models }) => {
      const meId = me?.id ?? USER_ID.anon
      if (meId !== item.userId) {
        // Only query for deleteScheduledAt for your own items to keep DB queries minimized
        return null
      }
      const deleteJobs = await models.$queryRaw`
        SELECT startafter
        FROM pgboss.job
        WHERE name = 'deleteItem' AND data->>'id' = ${item.id}::TEXT
        AND state = 'created'`
      return deleteJobs[0]?.startafter ?? null
    },
    reminderScheduledAt: async (item, args, { me, models }) => {
      const meId = me?.id ?? USER_ID.anon
      if (meId !== item.userId || meId === USER_ID.anon) {
        // don't show reminders on an item if it isn't yours
        // don't support reminders for ANON
        return null
      }
      const reminderJobs = await models.$queryRaw`
        SELECT startafter
        FROM pgboss.job
        WHERE name = 'reminder'
        AND data->>'itemId' = ${item.id}::TEXT
        AND data->>'userId' = ${meId}::TEXT
        AND state = 'created'`
      return reminderJobs[0]?.startafter ?? null
    }
  }
}

export const updateItem = async (parent, { sub: subName, forward, ...item }, { me, models, lnd }) => {
  // update iff this item belongs to me
  const old = await models.item.findUnique({ where: { id: Number(item.id) }, include: { sub: true } })

  if (old.deletedAt) {
    throw new GraphQLError('item is deleted', { extensions: { code: 'BAD_INPUT' } })
  }

  if (old.invoiceActionState && old.invoiceActionState !== 'PAID') {
    throw new GraphQLError('cannot edit unpaid item', { extensions: { code: 'BAD_INPUT' } })
  }

  // author can always edit their own item
  const mid = Number(me?.id)
  const isMine = Number(old.userId) === mid

  // allow admins to edit special items
  const allowEdit = ITEM_ALLOW_EDITS.includes(old.id)
  const adminEdit = SN_USER_IDS.includes(mid) && allowEdit

  if (!isMine && !adminEdit) {
    throw new GraphQLError('item does not belong to you', { extensions: { code: 'FORBIDDEN' } })
  }

  const differentSub = subName && old.subName !== subName
  if (differentSub) {
    const sub = await models.sub.findUnique({ where: { name: subName } })
    if (old.freebie) {
      if (!sub.allowFreebies) {
        throw new GraphQLError(`~${subName} does not allow freebies`, { extensions: { code: 'BAD_INPUT' } })
      }
    } else if (sub.baseCost > old.sub.baseCost) {
      throw new GraphQLError('cannot change to a more expensive sub', { extensions: { code: 'BAD_INPUT' } })
    }
  }

  // in case they lied about their existing boost
  await ssValidate(advSchema, { boost: item.boost }, { models, me, existingBoost: old.boost })

  const user = await models.user.findUnique({ where: { id: me.id } })

  // prevent update if it's not explicitly allowed, not their bio, not their job and older than 10 minutes
  const myBio = user.bioId === old.id
  const timer = Date.now() < new Date(old.invoicePaidAt ?? old.createdAt).getTime() + 10 * 60_000

  if (!allowEdit && !myBio && !timer && !isJob(item)) {
    throw new GraphQLError('item can no longer be editted', { extensions: { code: 'BAD_INPUT' } })
  }

  if (item.url && !isJob(item)) {
    item.url = ensureProtocol(item.url)
    item.url = removeTracking(item.url)
  }

  // prevent editing a bio like a regular item
  if (old.bio) {
    item = { id: Number(item.id), text: item.text, title: `@${user.name}'s bio`, userId: me.id }
  } else {
    item = { subName, userId: me.id, ...item }
    item.forwardUsers = await getForwardUsers(models, forward)
  }
  item.uploadIds = uploadIdsFromText(item.text, { models })

  const resultItem = await performPaidAction('ITEM_UPDATE', item, { models, me, lnd })

  resultItem.comments = []
  return resultItem
}

export const createItem = async (parent, { forward, ...item }, { me, models, lnd }) => {
  // rename to match column name
  item.subName = item.sub
  delete item.sub

  item.userId = me ? Number(me.id) : USER_ID.anon

  item.forwardUsers = await getForwardUsers(models, forward)
  item.uploadIds = uploadIdsFromText(item.text, { models })

  if (item.url && !isJob(item)) {
    item.url = ensureProtocol(item.url)
    item.url = removeTracking(item.url)
  }

  if (item.parentId) {
    const parent = await models.item.findUnique({ where: { id: parseInt(item.parentId) } })
    if (parent.invoiceActionState && parent.invoiceActionState !== 'PAID') {
      throw new GraphQLError('cannot comment on unpaid item', { extensions: { code: 'BAD_INPUT' } })
    }
  }

  // mark item as created with API key
  item.apiKey = me?.apiKey

  const resultItem = await performPaidAction('ITEM_CREATE', item, { models, me, lnd })

  resultItem.comments = []
  return resultItem
}

export const getForwardUsers = async (models, forward) => {
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
  `SELECT "Item".*, "Item".created_at as "createdAt", "Item".updated_at as "updatedAt",
    ltree2text("Item"."path") AS "path"`

function topOrderByWeightedSats (me, models) {
  return `ORDER BY ${orderByNumerator(models)} DESC NULLS LAST, "Item".id DESC`
}
