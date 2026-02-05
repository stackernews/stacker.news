import { ensureProtocol, removeTracking, stripTrailingSlash } from '@/lib/url'
import { snFetch } from '@/lib/fetch'
import { decodeCursor, nextCursorEncoded } from '@/lib/cursor'
import { getMetadata, metadataRuleSets } from 'page-metadata-parser'
import { ruleSet as publicationDateRuleSet } from '@/lib/timedate-scraper'
import domino from 'domino'
import {
  ITEM_SPAM_INTERVAL,
  COMMENT_DEPTH_LIMIT, COMMENT_TYPE_QUERY,
  USER_ID, POLL_COST, ADMIN_ITEMS, GLOBAL_SEED,
  NOFOLLOW_LIMIT, UNKNOWN_LINK_REL, SN_ADMIN_IDS,
  ITEM_EDIT_SECONDS,
  COMMENTS_LIMIT,
  COMMENTS_OF_COMMENT_LIMIT,
  FULL_COMMENTS_THRESHOLD,
  WALLET_RETRY_BEFORE_MS,
  WALLET_MAX_RETRIES,
  DEFAULT_POSTS_SATS_FILTER,
  DEFAULT_COMMENTS_SATS_FILTER,
  HOMEPAGE_POSTS_SATS_FILTER
} from '@/lib/constants'
import { msatsToSats } from '@/lib/format'
import uu from 'url-unshort'
import { actSchema, advSchema, bountySchema, commentSchema, discussionSchema, jobSchema, linkSchema, pollSchema, validateSchema } from '@/lib/validate'
import { defaultCommentSort, isJob, deleteItemByAuthor } from '@/lib/item'
import { datePivot, whenRange } from '@/lib/time'
import { uploadIdsFromText } from './upload'
import assertGofacYourself from './ofac'
import assertApiKeyNotPermitted from './apiKey'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { verifyHmac } from './wallet'
import { parse } from 'tldts'
import { shuffleArray } from '@/lib/rand'
import pay from '../payIn'
import { lexicalHTMLGenerator } from '@/lib/lexical/server/html'

function commentsOrderByClause (sort, commentsSatsFilter = DEFAULT_COMMENTS_SATS_FILTER) {
  const sharedSortsArray = []
  sharedSortsArray.push('("Item"."pinId" IS NOT NULL) DESC')
  sharedSortsArray.push('("Item"."deletedAt" IS NULL) DESC')

  // Push comments with investment below the threshold to the bottom of threads
  // This applies to all comments (including freebies) with netInvestment below the filter
  if (commentsSatsFilter > 0) {
    sharedSortsArray.push(`(CASE WHEN "Item"."netInvestment" < ${commentsSatsFilter} THEN 1 ELSE 0 END) ASC`)
  }

  const sharedSorts = sharedSortsArray.join(', ')

  if (sort === 'recent') {
    return `ORDER BY ${sharedSorts},
      "Item".created_at DESC, "Item".id DESC`
  }

  if (sort === 'hot') {
    return `ORDER BY ${sharedSorts},
      "Item"."rankhot" DESC, "Item".id DESC`
  } else {
    return `ORDER BY ${sharedSorts}, "Item"."ranktop" DESC, "Item".id DESC`
  }
}

async function comments (me, models, item, sort, cursor) {
  // Get user's commentsSatsFilter to push filtered freebies to bottom
  let commentsSatsFilter = DEFAULT_COMMENTS_SATS_FILTER
  if (me) {
    const user = await models.user.findUnique({ where: { id: me.id }, select: { commentsSatsFilter: true } })
    commentsSatsFilter = user?.commentsSatsFilter ?? DEFAULT_COMMENTS_SATS_FILTER
  }

  const orderBy = commentsOrderByClause(sort, commentsSatsFilter)

  // if we're logged in, there might be pending comments from us we want to show but weren't counted
  if (!me && item.nDirectComments === 0) {
    return {
      comments: [],
      cursor: null
    }
  }

  const decodedCursor = decodeCursor(cursor)
  const offset = decodedCursor.offset
  const filter = ` AND ("Item"."parentId" <> $1 OR "Item".created_at <= '${decodedCursor.time.toISOString()}'::TIMESTAMP(3)) `

  // XXX what a mess
  let comments
  if (me) {
    if (item.ncomments > FULL_COMMENTS_THRESHOLD) {
      const [{ item_comments_zaprank_with_me_limited: limitedComments }] = await models.$queryRawUnsafe(
        'SELECT item_comments_zaprank_with_me_limited($1::INTEGER, $2::INTEGER, $3::INTEGER, $4::INTEGER, $5::INTEGER, $6::INTEGER, $7::INTEGER, $8, $9)',
        Number(item.id), GLOBAL_SEED, Number(me.id), COMMENTS_LIMIT, offset, COMMENTS_OF_COMMENT_LIMIT, COMMENT_DEPTH_LIMIT, filter, orderBy)
      comments = limitedComments
    } else {
      const [{ item_comments_zaprank_with_me: fullComments }] = await models.$queryRawUnsafe(
        'SELECT item_comments_zaprank_with_me($1::INTEGER, $2::INTEGER, $3::INTEGER, $4::INTEGER, $5, $6)',
        Number(item.id), GLOBAL_SEED, Number(me.id), COMMENT_DEPTH_LIMIT, filter, orderBy)
      comments = fullComments
    }
  } else {
    if (item.ncomments > FULL_COMMENTS_THRESHOLD) {
      const [{ item_comments_limited: limitedComments }] = await models.$queryRawUnsafe(
        'SELECT item_comments_limited($1::INTEGER, $2::INTEGER, $3::INTEGER, $4::INTEGER, $5::INTEGER, $6, $7)',
        Number(item.id), COMMENTS_LIMIT, offset, COMMENTS_OF_COMMENT_LIMIT, COMMENT_DEPTH_LIMIT, filter, orderBy)
      comments = limitedComments
    } else {
      const [{ item_comments: fullComments }] = await models.$queryRawUnsafe(
        'SELECT item_comments($1::INTEGER, $2::INTEGER, $3, $4)', Number(item.id), COMMENT_DEPTH_LIMIT, filter, orderBy)
      comments = fullComments
    }
  }

  return {
    comments,
    cursor: comments.length + offset < item.nDirectComments ? nextCursorEncoded(decodedCursor, COMMENTS_LIMIT) : null
  }
}

export async function getItem (parent, { id }, { me, models }) {
  const [item] = await itemQueryWithMeta({
    me,
    models,
    query: `
      ${SELECT}
      FROM "Item"
      ${payInJoinFilter(me)}
      ${whereClause(
        '"Item".id = $1',
        activeOrMine(me)
      )}`
  }, Number(id))
  return item
}

export async function getAd (parent, { sub, subArr = [], showNsfw = false }, { me, models }) {
  return (await itemQueryWithMeta({
    me,
    models,
    query: `
      ${SELECT}
      FROM "Item"
      ${payInJoinFilter(me)}
      ${whereClause(
        '"parentId" IS NULL',
        '"Item"."pinId" IS NULL',
        '"Item"."deletedAt" IS NULL',
        '"Item"."parentId" IS NULL',
        '"Item".bio = false',
        '"Item".boost > 0',
        await filterClause(me, models, null, sub, 'hot'),
        activeOrMine(),
        subClause(sub, 1, 'Item', me, showNsfw),
        muteClause(me))}
      ORDER BY rankboost DESC, "Item".created_at ASC
      LIMIT 1`
  }, ...subArr))?.[0] || null
}

const orderByClause = (by, me, models, type, sub) => {
  switch (by) {
    case 'comments':
      return 'ORDER BY "Item".ncomments DESC'
    case 'sats':
      return 'ORDER BY "Item".msats DESC'
    case 'zaprank':
      return 'ORDER BY "Item".ranktop DESC, "Item".id DESC'
    case 'boost':
      return 'ORDER BY "Item".boost + "Item"."oldBoost" DESC'
    case 'random':
      return 'ORDER BY RANDOM()'
    default:
      return `ORDER BY ${type === 'bookmarks' ? '"bookmarkCreatedAt"' : '"Item".created_at'} DESC`
  }
}

// this grabs all the stuff we need to display the item list and only
// hits the db once ... orderBy needs to be duplicated on the outer query because
// joining does not preserve the order of the inner query
export async function itemQueryWithMeta ({ me, models, query, orderBy = '' }, ...args) {
  if (!me) {
    return await models.$queryRawUnsafe(`
      SELECT "Item".*, to_json(users.*) as user, "subs".subs as subs, to_jsonb("PayIn".*) as "payIn"
      FROM (
        ${query}
      ) "Item"
      JOIN users ON "Item"."userId" = users.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(json_agg("Sub".*), '[]') as subs
        FROM "Sub"
        WHERE "Sub"."name" = ANY("Item"."subNames")
      ) "subs" ON true
      LEFT JOIN LATERAL (
        SELECT "PayIn".*
        FROM "ItemPayIn"
        JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = 'ITEM_CREATE'
        WHERE "ItemPayIn"."itemId" = "Item".id AND "PayIn"."payInState" = 'PAID'
        ORDER BY "PayIn"."created_at" DESC
        LIMIT 1
      ) "PayIn" ON "PayIn".id IS NOT NULL
      ${orderBy}`, ...args)
  } else {
    return await models.$queryRawUnsafe(`
      SELECT "Item".*, to_jsonb(users.*) || jsonb_build_object('meMute', "Mute"."mutedId" IS NOT NULL) as user,
        COALESCE("MeItemPayIn"."meMsats", 0) as "meMsats", COALESCE("MeItemPayIn"."mePendingMsats", 0) as "mePendingMsats",
        COALESCE("MeItemPayIn"."meMcredits", 0) as "meMcredits", COALESCE("MeItemPayIn"."mePendingMcredits", 0) as "mePendingMcredits",
        COALESCE("MeItemPayIn"."meDontLikeMsats", 0) as "meDontLikeMsats", COALESCE("MeItemPayIn"."mePendingDontLikeMsats", 0) as "mePendingDontLikeMsats",
        COALESCE("MeItemPayIn"."mePendingBoostMsats", 0) as "mePendingBoostMsats",
        b."itemId" IS NOT NULL AS "meBookmark", "ThreadSubscription"."itemId" IS NOT NULL AS "meSubscription",
        "ItemForward"."itemId" IS NOT NULL AS "meForward", "subs".subs as subs,
        to_jsonb("PayIn".*) || jsonb_build_object('payInStateChangedAt', "PayIn"."payInStateChangedAt" AT TIME ZONE 'UTC') as "payIn",
        "CommentsViewAt"."last_viewed_at" as "meCommentsViewedAt"
      FROM (
        ${query}
      ) "Item"
      JOIN users ON "Item"."userId" = users.id
      LEFT JOIN "Mute" ON "Mute"."muterId" = ${me.id} AND "Mute"."mutedId" = "Item"."userId"
      LEFT JOIN "Bookmark" b ON b."itemId" = "Item".id AND b."userId" = ${me.id}
      LEFT JOIN "ThreadSubscription" ON "ThreadSubscription"."itemId" = "Item".id AND "ThreadSubscription"."userId" = ${me.id}
      LEFT JOIN "ItemForward" ON "ItemForward"."itemId" = "Item".id AND "ItemForward"."userId" = ${me.id}
      LEFT JOIN "CommentsViewAt" ON "CommentsViewAt"."itemId" = "Item".id AND "CommentsViewAt"."userId" = ${me.id}
      LEFT JOIN LATERAL (
        SELECT COALESCE(json_agg("Sub".*), '[]') as subs
        FROM (
          SELECT "Sub".*, "MuteSub"."userId" IS NOT NULL as "meMuteSub", "SubSubscription"."userId" IS NOT NULL as "meSubscription"
          FROM "Sub"
          LEFT JOIN "MuteSub" ON "Sub"."name" = "MuteSub"."subName" AND "MuteSub"."userId" = ${me.id}
          LEFT JOIN "SubSubscription" ON "Sub"."name" = "SubSubscription"."subName" AND "SubSubscription"."userId" = ${me.id}
          WHERE "Sub"."name" = ANY("Item"."subNames")
        ) "Sub"
      ) "subs" ON true
      LEFT JOIN LATERAL (
        SELECT "itemId",
          sum("PayIn".mcost) FILTER (WHERE "PayOutBolt11".id IS NOT NULL AND "PayIn"."payInType" = 'ZAP') AS "meMsats",
          sum("PayIn".mcost) FILTER (WHERE "PayOutBolt11".id IS NULL AND "PayIn"."payInType" = 'ZAP') AS "meMcredits",
          sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" <> 'PAID' AND "PayOutBolt11".id IS NOT NULL AND "PayIn"."payInType" = 'ZAP') AS "mePendingMsats",
          sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" <> 'PAID' AND "PayOutBolt11".id IS NULL AND "PayIn"."payInType" = 'ZAP') AS "mePendingMcredits",
          sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInType" = 'DOWN_ZAP') AS "meDontLikeMsats",
          sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInType" = 'DOWN_ZAP' AND "PayIn"."payInState" <> 'PAID') AS "mePendingDontLikeMsats",
          sum("PayIn".mcost) FILTER (WHERE "PayIn"."payInState" <> 'PAID' AND "PayIn"."payInType" = 'BOOST') AS "mePendingBoostMsats"
        FROM "ItemPayIn"
        JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId"
        LEFT JOIN "PayOutBolt11" ON "PayOutBolt11"."payInId" = "PayIn"."id"
        WHERE "PayIn"."userId" = ${me.id}
        AND "ItemPayIn"."itemId" = "Item".id
        AND (
          "PayIn"."payInState" = 'PAID'
          -- some kind of pending state
          OR "PayIn"."payInState" <> 'FAILED'
          OR (
            -- going to be retrying
            "PayIn"."payInState" = 'FAILED'
            AND "PayIn"."payInFailureReason" <> 'USER_CANCELLED'
            AND "PayIn"."payInStateChangedAt" > now() - '${WALLET_RETRY_BEFORE_MS} milliseconds'::interval
            AND "PayIn"."retryCount" < ${WALLET_MAX_RETRIES}::integer
            AND "PayIn"."successorId" IS NULL
          )
        )
        GROUP BY "ItemPayIn"."itemId"
      ) "MeItemPayIn" ON true
      LEFT JOIN LATERAL (
        SELECT "PayIn".*
        FROM "ItemPayIn"
        JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = 'ITEM_CREATE'
        WHERE "ItemPayIn"."itemId" = "Item".id AND ("PayIn"."userId" = ${me.id} OR "PayIn"."payInState" = 'PAID')
        ORDER BY "PayIn"."created_at" DESC
        LIMIT 1
      ) "PayIn" ON "PayIn".id IS NOT NULL
      ${orderBy}`, ...args)
  }
}

const relationClause = (type) => {
  let clause = ''
  switch (type) {
    case 'bookmarks':
      clause += ' FROM "Item" JOIN "Bookmark" ON "Bookmark"."itemId" = "Item"."id" LEFT JOIN "Item" root ON "Item"."rootId" = root.id '
      break
    case 'comments':
    case 'freebies':
    case 'all':
      clause += ' FROM "Item" LEFT JOIN "Item" root ON "Item"."rootId" = root.id '
      break
    default: // posts which are their own root
      clause += ' FROM "Item" '
  }

  return clause
}

export const payInJoinFilter = me => {
  if (me) {
    return `
      JOIN "ItemPayIn" ON "ItemPayIn"."itemId" = "Item".id
      JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = 'ITEM_CREATE'
        AND (("PayIn"."userId" = ${me.id} AND "PayIn"."successorId" IS NULL) OR "PayIn"."payInState" = 'PAID')
    `
  }

  return `
      JOIN "ItemPayIn" ON "ItemPayIn"."itemId" = "Item".id
      JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = 'ITEM_CREATE'
        AND "PayIn"."payInState" = 'PAID'
    `
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
    ? `("Item".status <> 'STOPPED' OR "Item"."userId" = ${me.id})`
    : '"Item".status <> \'STOPPED\''
}

export const muteClause = me =>
  me ? `NOT EXISTS (SELECT 1 FROM "Mute" WHERE "Mute"."muterId" = ${me.id} AND "Mute"."mutedId" = "Item"."userId")` : ''

const subClause = (sub, num, table = 'Item', me, showNsfw) => {
  // Intentionally show nsfw posts (i.e. no nsfw clause) when viewing a specific nsfw sub
  if (sub) {
    const tables = [...new Set(['Item', table])].map(t => `"${t}".`)
    return `(${tables.map(t => `${t}"subNames" @> ARRAY[$${num}]::CITEXT[]`).join(' OR ')})`
  }

  // XXX heh, we don't have any nsfw subs so we don't need to hide them
  const hideNsfwClause = undefined // `NOT EXISTS (SELECT 1 FROM "Sub" WHERE "Sub"."name" = ANY(${table ? `"${table}".` : ''}"subNames") AND "Sub"."nsfw" = TRUE)`

  if (!me) { return hideNsfwClause }

  const excludeMuted = `NOT EXISTS (SELECT 1 FROM "MuteSub" WHERE "MuteSub"."userId" = ${me.id} AND "MuteSub"."subName" = ANY(${table ? `"${table}".` : ''}"subNames"))`
  if (showNsfw) return excludeMuted

  return [excludeMuted, hideNsfwClause].filter(Boolean).join(' AND ')
}

// Uses the indexed netInvestment column for efficient filtering
function investmentClause (postsSatsFilter, commentsSatsFilter, meId) {
  const ownerClause = meId ? ` OR "Item"."userId" = ${meId}` : ''
  return `(
    CASE WHEN "Item"."parentId" IS NULL
      THEN "Item"."netInvestment" >= ${postsSatsFilter}${ownerClause}
      ELSE "Item"."netInvestment" >= ${commentsSatsFilter}${ownerClause}
    END
  )`
}

export async function filterClause (me, models, type, sub, sort) {
  // if you are explicitly asking for freebies or bios, don't filter them
  if (type === 'freebies' || type === 'bios') {
    return ''
  }

  // Default filter values for logged out users
  let postsSatsFilter = DEFAULT_POSTS_SATS_FILTER
  let commentsSatsFilter = DEFAULT_COMMENTS_SATS_FILTER

  if (me) {
    const user = await models.user.findUnique({ where: { id: me.id } })
    postsSatsFilter = user.postsSatsFilter
    commentsSatsFilter = user.commentsSatsFilter
  }

  // For hot/top/random feeds, apply territory or homepage filter
  // For recent or undefined sort (e.g. notifications), only use user's filter
  if (sort === 'hot' || sort === 'top' || sort === 'random') {
    if (sub) {
      // In a territory: max of user filter and territory filter
      const territory = await models.sub.findUnique({ where: { name: sub } })
      if (territory) {
        postsSatsFilter = Math.max(postsSatsFilter, territory.postsSatsFilter)
      }
    } else {
      // On homepage (null sub): max of user filter and homepage threshold
      postsSatsFilter = Math.max(postsSatsFilter, HOMEPAGE_POSTS_SATS_FILTER)
    }
  }

  return investmentClause(postsSatsFilter, commentsSatsFilter, me?.id)
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
    case 'bounties_active':
      return ['"Item".bounty IS NOT NULL', '"Item"."parentId" IS NULL', '"Item"."bountyPaidTo" IS NULL']
    case 'comments':
      return '"Item"."parentId" IS NOT NULL'
    case 'freebies':
      return '"Item".freebie = true'
    case 'all':
    case 'bookmarks':
      return ''
    case 'jobs':
      return '"Item"."subNames" @> ARRAY[\'jobs\']'
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
    items: async (parent, { sub, sort, type, cursor, name, when, from, to, by, limit }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      let items, user, pins, subFull, table, ad

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
            throw new GqlInputError('must supply name')
          }

          user ??= await models.user.findUnique({ where: { name } })
          if (!user) {
            throw new GqlInputError('no user has that name')
          }

          table = type === 'bookmarks' ? 'Bookmark' : 'Item'
          items = await itemQueryWithMeta({
            me,
            models,
            query: `
              ${selectClause(type)}
              ${relationClause(type)}
              ${payInJoinFilter(me)}
              ${whereClause(
                `"${table}"."userId" = $3`,
                activeOrMine(me),
                typeClause(type),
                by === 'boost' && '"Item".boost > 0',
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
              ${payInJoinFilter(me)}
              ${whereClause(
                '"Item".created_at <= $1',
                '"Item"."deletedAt" IS NULL',
                subClause(sub, 4, subClauseTable(type), me, showNsfw),
                activeOrMine(me),
                await filterClause(me, models, type, sub, 'recent'),
                typeClause(type),
                muteClause(me)
              )}
              ORDER BY "PayIn"."payInStateChangedAt" DESC
              OFFSET $2
              LIMIT $3`,
            orderBy: 'ORDER BY "PayIn"."payInStateChangedAt" DESC'
          }, decodedCursor.time, decodedCursor.offset, limit, ...subArr)
          break
        case 'top':
          items = await itemQueryWithMeta({
            me,
            models,
            query: `
              ${selectClause(type)}
              ${relationClause(type)}
              ${payInJoinFilter(me)}
              ${whereClause(
                '"Item"."deletedAt" IS NULL',
                type === 'posts' && '"Item"."subNames" IS NOT NULL',
                subClause(sub, 5, subClauseTable(type), me, showNsfw),
                typeClause(type),
                whenClause(when, 'Item'),
                activeOrMine(me),
                await filterClause(me, models, type, sub, 'top'),
                by === 'boost' && '"Item".boost > 0',
                muteClause(me))}
              ${orderByClause(by || 'zaprank', me, models, type, sub)}
              OFFSET $3
              LIMIT $4`,
            orderBy: orderByClause(by || 'zaprank', me, models, type, sub)
          }, ...whenRange(when, from, to || decodedCursor.time), decodedCursor.offset, limit, ...subArr)
          break
        case 'random':
          items = await itemQueryWithMeta({
            me,
            models,
            query: `
              ${selectClause(type)}
              ${relationClause(type)}
              ${whereClause(
                '"Item"."deletedAt" IS NULL',
                '"Item"."weightedVotes" - "Item"."weightedDownVotes" > 2',
                '"Item"."ncomments" > 0',
                '"Item"."parentId" IS NULL',
                '"Item".bio = false',
                type === 'posts' && '"Item"."subNames" IS NOT NULL',
                subClause(sub, 3, subClauseTable(type), me, showNsfw),
                typeClause(type),
                await filterClause(me, models, type, sub, 'random'),
                activeOrMine(me),
                muteClause(me))}
              ${orderByClause('random', me, models, type)}
              OFFSET $1
              LIMIT $2`,
            orderBy: orderByClause('random', me, models, type)
          }, decodedCursor.offset, limit, ...subArr)
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
                    (boost IS NOT NULL AND boost > 0)::INT AS group_rank,
                    CASE WHEN boost IS NOT NULL AND boost > 0
                         THEN rank() OVER (ORDER BY rankboost DESC, "Item".created_at ASC)
                         ELSE rank() OVER (ORDER BY "Item".created_at DESC) END AS rank
                    FROM "Item"
                    ${payInJoinFilter(me)}
                    ${whereClause(
                      '"parentId" IS NULL',
                      '"Item"."deletedAt" IS NULL',
                      activeOrMine(me),
                      '"Item".created_at <= $1',
                      '"pinId" IS NULL',
                      subClause(sub, 4)
                    )}
                    ORDER BY group_rank DESC, rank
                  OFFSET $2
                  LIMIT $3`,
                orderBy: 'ORDER BY group_rank DESC, rank'
              }, decodedCursor.time, decodedCursor.offset, limit, ...subArr)
              break
            default:
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
                      ${payInJoinFilter(me)}
                      ${whereClause(
                        '"pinId" IS NOT NULL',
                        '"parentId" IS NULL',
                        sub ? '"Item"."subNames" @> ARRAY[$1]::CITEXT[]' : '"Item"."subNames" IS NULL',
                        muteClause(me))}
                  ) rank_filter WHERE RANK = 1
                  ORDER BY position ASC`,
                  orderBy: 'ORDER BY position ASC'
                }, ...subArr)
              }

              items = await itemQueryWithMeta({
                me,
                models,
                query: `
                    ${SELECT}
                    FROM "Item"
                    ${payInJoinFilter(me)}
                    ${whereClause(
                      // in home (sub undefined), filter out global pinned items since we inject them later
                      sub ? '"Item"."pinId" IS NULL' : 'NOT ("Item"."pinId" IS NOT NULL AND "Item"."subNames" IS NULL)',
                      '"Item"."deletedAt" IS NULL',
                      '"Item"."parentId" IS NULL',
                      '"Item".bio = false',
                      ad ? `"Item".id <> ${ad.id}` : '',
                      activeOrMine(me),
                      await filterClause(me, models, type, sub, 'hot'),
                      subClause(sub, 3, 'Item', me, showNsfw),
                      muteClause(me))}
                    ORDER BY rankhot DESC, "Item".id DESC
                    OFFSET $1
                    LIMIT $2`,
                orderBy: 'ORDER BY rankhot DESC, "Item".id DESC'
              }, decodedCursor.offset, limit, ...subArr)
              break
          }
          break
      }
      return {
        cursor: items.length === limit ? nextCursorEncoded(decodedCursor, limit) : null,
        items,
        pins,
        ad
      }
    },
    item: getItem,
    pageTitleAndUnshorted: async (parent, { url }, { models }) => {
      const res = {}
      try {
        const response = await snFetch(url, { protocol: 'http', redirect: 'follow' })
        const html = await response.text()
        const doc = domino.createWindow(html).document
        const titleRuleSet = {
          rules: [
            ['h1 > yt-formatted-string.ytd-watch-metadata', el => el.getAttribute('title')],
            ...metadataRuleSets.title.rules
          ]
        }
        const metadata = getMetadata(doc, url, { title: titleRuleSet, publicationDate: publicationDateRuleSet })
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
      let { hostname, pathname } = urlObj

      const parseResult = parse(urlObj.hostname)
      if (parseResult?.subdomain?.length > 0) {
        hostname = hostname.replace(`${parseResult.subdomain}.`, '')
      }
      // hostname with optional protocol, subdomain, and port
      const hostnameRegex = `^(http(s)?:\\/\\/)?(\\w+\\.)?${(hostname + '(:[0-9]+)?').replace(/\./g, '\\.')}`
      // pathname with trailing slash and escaped special characters
      const pathnameRegex = stripTrailingSlash(pathname).replace(/(\+|\.|\/)/g, '\\$1') + '\\/?'
      // url with optional trailing slash
      let similar = hostnameRegex + pathnameRegex

      const whitelist = ['news.ycombinator.com/item', 'bitcointalk.org/index.php']
      const youtube = ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be']

      const hostAndPath = stripTrailingSlash(urlObj.hostname + urlObj.pathname)
      if (whitelist.includes(hostAndPath)) {
        // make query string match for whitelist domains
        similar += `\\${urlObj.search}`
      } else if (youtube.includes(urlObj.hostname)) {
        // extract id and create both links
        const matches = url.match(/(https?:\/\/)?((www\.)?(youtube(-nocookie)?|youtube.googleapis)\.com.*(v\/|v=|vi=|vi\/|e\/|embed\/|user\/.*\/u\/\d+\/)|youtu\.be\/)(?<id>[_0-9a-z-]+)/i)
        similar = `^(http(s)?:\\/\\/)?((www\\.|m\\.)?youtube.com\\/(watch\\?v\\=|v\\/|live\\/)${matches?.groups?.id}|youtu\\.be\\/${matches?.groups?.id})&?`
      } else if (urlObj.hostname === 'yewtu.be') {
        const matches = url.match(/(https?:\/\/)?yewtu\.be.*(v=|embed\/)(?<id>[_0-9a-z-]+)/i)
        similar = `^(http(s)?:\\/\\/)?yewtu\\.be\\/(watch\\?v\\=|embed\\/)${matches?.groups?.id}&?`
      } else {
        // only allow ending of mismatching search params
        similar += '(?:\\?.*)?$'
      }

      return await itemQueryWithMeta({
        me,
        models,
        query: `
          ${SELECT}
          FROM "Item"
          ${payInJoinFilter(me)}
          WHERE url ~* $1
          ORDER BY created_at DESC
          LIMIT 3`
      }, similar)
    },
    newComments: async (parent, { itemId, after }, { models, me }) => {
      const comments = await itemQueryWithMeta({
        me,
        models,
        query: `
          ${SELECT}
          FROM "Item"
          ${payInJoinFilter(me)}
          -- comments can be nested, so we need to get all comments that are descendants of the root
          ${whereClause(
            '"Item".path <@ (SELECT path FROM "Item" WHERE id = $1 AND "Item"."lastCommentAt" > $2)',
            activeOrMine(me),
            '"Item"."created_at" > $2'
          )}
          ORDER BY "Item"."created_at" ASC`
      }, Number(itemId), after)

      return { comments }
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
        throw new GqlAuthenticationError()
      }

      const item = await models.item.findUnique({
        where: { id: Number(id) },
        include: { pin: true, root: true, subs: { include: { sub: true } } }
      })

      if (item.parentId) {
        // OPs can only pin top level replies
        if (item.parentId !== item.rootId) {
          throw new GqlInputError('can only pin root replies')
        }

        if (item.root.userId !== Number(me.id)) {
          throw new GqlInputError('not your post')
        }
      } else if (item.subs?.length === 1) {
        // only territory founder can pin posts
        const sub = item.subs[0].sub
        if (Number(me.id) !== sub.userId) {
          throw new GqlInputError('not your sub')
        }
      } else {
        throw new GqlInputError('item must belong to a single sub or be a comment')
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
              ${whereClause(
                '"pinId" IS NOT NULL',
                item.parentId ? 'i."parentId" = $1' : 'i."subNames" @> ARRAY[$1]::CITEXT[]')}
            )`, item.parentId ?? item.subNames[0], item.pin.position)
        ])

        pinId = null
      } else {
        // only max 3 pins allowed per territory and post
        const [{ count: npins }] = await models.$queryRawUnsafe(`
          SELECT COUNT(p.id)
          FROM "Pin" p
          JOIN "Item" i ON i."pinId" = p.id
          ${whereClause(
            item.parentId ? 'i."parentId" = $1' : 'i."subNames" @> ARRAY[$1]::CITEXT[]'
          )}`, item.parentId ?? item.subNames[0])

        if (npins >= 3) {
          throw new GqlInputError('max 3 pins allowed')
        }

        const [{ pinId: newPinId }] = await models.$queryRawUnsafe(`
          WITH pin AS (
            INSERT INTO "Pin" (position)
            SELECT COALESCE(MAX(p.position), 0) + 1 AS position
            FROM "Pin" p
            JOIN "Item" i ON i."pinId" = p.id
            ${whereClause(
              item.parentId ? 'i."parentId" = $1' : 'i."subNames" @> ARRAY[$1]::CITEXT[]'
            )}
            RETURNING id
          )
          UPDATE "Item"
          SET "pinId" = pin.id
          FROM pin
          WHERE "Item".id = $2
          RETURNING "pinId"`, item.parentId ?? item.subNames[0], item.id)

        pinId = newPinId
      }

      return { id, pinId }
    },
    subscribeItem: async (parent, { id }, { me, models }) => {
      const data = { itemId: Number(id), userId: me.id }
      const old = await models.threadSubscription.findUnique({ where: { userId_itemId: data } })
      if (old) {
        await models.$executeRaw`
          DELETE FROM "ThreadSubscription" ts
          USING "Item" i
          WHERE ts."userId" = ${me.id}
          AND i.path <@ (SELECT path FROM "Item" WHERE id = ${Number(id)})
          AND ts."itemId" = i.id
        `
      } else {
        await models.threadSubscription.create({ data })
      }
      return { id }
    },
    deleteItem: async (parent, { id }, { me, models }) => {
      const old = await models.item.findUnique({ where: { id: Number(id) } })
      if (Number(old.userId) !== Number(me?.id)) {
        throw new GqlInputError('item does not belong to you')
      }
      if (old.bio) {
        throw new GqlInputError('cannot delete bio')
      }

      return await deleteItemByAuthor({ models, id, item: old })
    },
    upsertLink: async (parent, { id, ...item }, { me, models, lnd }) => {
      await validateSchema(linkSchema, item, { models, me })

      if (id) {
        return await updateItem(parent, { id, ...item }, { me, models, lnd })
      } else {
        return await createItem(parent, item, { me, models, lnd })
      }
    },
    upsertDiscussion: async (parent, { id, ...item }, { me, models, lnd }) => {
      await validateSchema(discussionSchema, item, { models, me })

      if (id) {
        return await updateItem(parent, { id, ...item }, { me, models, lnd })
      } else {
        return await createItem(parent, item, { me, models, lnd })
      }
    },
    upsertBounty: async (parent, { id, ...item }, { me, models, lnd }) => {
      await validateSchema(bountySchema, item, { models, me })

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

      await validateSchema(pollSchema, item, { models, me, numExistingChoices })

      if (id) {
        return await updateItem(parent, { id, ...item }, { me, models, lnd })
      } else {
        item.pollCost = item.pollCost || POLL_COST
        return await createItem(parent, item, { me, models, lnd })
      }
    },
    upsertJob: async (parent, { id, ...item }, { me, models, lnd }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      item.location = item.location?.toLowerCase() === 'remote' ? undefined : item.location
      await validateSchema(jobSchema, item, { models })
      if (item.logo !== undefined) {
        item.uploadId = item.logo
        delete item.logo
      }

      if (id) {
        return await updateItem(parent, { id, ...item }, { me, models, lnd })
      } else {
        return await createItem(parent, item, { me, models, lnd })
      }
    },
    upsertComment: async (parent, { id, ...item }, { me, models, lnd }) => {
      await validateSchema(commentSchema, item)

      if (id) {
        return await updateItem(parent, { id, ...item }, { me, models, lnd })
      } else {
        return await createItem(parent, item, { me, models, lnd })
      }
    },
    updateNoteId: async (parent, { id, noteId }, { me, models }) => {
      if (!id) {
        throw new GqlInputError('id required')
      }

      await models.item.update({
        where: { id: Number(id), userId: Number(me.id) },
        data: { noteId }
      })

      return { id, noteId }
    },
    pollVote: async (parent, { id }, { me, models, lnd }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      return await pay('POLL_VOTE', { id }, { me, models })
    },
    act: async (parent, { id, sats, act = 'TIP', hasSendWallet }, { me, models, lnd, headers }) => {
      assertApiKeyNotPermitted({ me })
      await validateSchema(actSchema, { sats, act })
      await assertGofacYourself({ models, headers })

      const item = await models.item.findUnique({
        where: { id: Number(id) },
        include: {
          itemPayIns: {
            where: {
              payIn: {
                payInType: 'ITEM_CREATE',
                payInState: 'PAID'
              }
            }
          }
        }
      })

      if (item.itemPayIns.length === 0) {
        throw new GqlInputError('cannot act on unpaid item')
      }

      if (item.deletedAt) {
        throw new GqlInputError('item is deleted')
      }

      // disallow self tips except anons
      if (me && ['TIP', 'DONT_LIKE_THIS'].includes(act)) {
        if (Number(item.userId) === Number(me.id)) {
          throw new GqlInputError('cannot zap yourself')
        }

        // Disallow tips if me is one of the forward user recipients
        if (act === 'TIP') {
          const existingForwards = await models.itemForward.findMany({ where: { itemId: Number(id) } })
          if (existingForwards.some(fwd => Number(fwd.userId) === Number(me.id))) {
            throw new GqlInputError('cannot zap a post for which you are forwarded zaps')
          }
        }
      }

      if (act === 'TIP') {
        return await pay('ZAP', { id, sats, hasSendWallet }, { me, models })
      } else if (act === 'DONT_LIKE_THIS') {
        return await pay('DOWN_ZAP', { id, sats }, { me, models })
      } else if (act === 'BOOST') {
        return await pay('BOOST', { id, sats }, { me, models })
      } else {
        throw new GqlInputError('unknown act')
      }
    },
    updateCommentsViewAt: async (parent, { id, meCommentsViewedAt }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      const result = await models.commentsViewAt.upsert({
        where: {
          userId_itemId: { userId: Number(me.id), itemId: Number(id) }
        },
        update: { lastViewedAt: new Date(meCommentsViewedAt) },
        create: { userId: Number(me.id), itemId: Number(id), lastViewedAt: new Date(meCommentsViewedAt) }
      })

      return result.lastViewedAt
    }
  },
  Item: {
    payIn: async (item, args, { models }) => {
      if (typeof item.payIn !== 'undefined') {
        return item.payIn
      }

      // TODO: very inefficient on a relative basis, so if need be we can:
      // 1. denormalize payInId that created the item to it
      // 2. add this to the getItemMeta query (done)
      const payIn = await models.payIn.findFirst({
        where: {
          itemPayIn: {
            itemId: item.id
          },
          payInType: 'ITEM_CREATE',
          successorId: null
        }
      })
      return payIn
    },
    sats: async (item, args, { models, me }) => {
      if (me?.id === item.userId) {
        return msatsToSats(BigInt(item.msats))
      }
      return msatsToSats(BigInt(item.msats) + BigInt(item.mePendingMsats || 0) + BigInt(item.mePendingMcredits || 0))
    },
    downSats: async (item, args, { models, me }) => {
      if (me?.id === item.userId) {
        return msatsToSats(BigInt(item.downMsats))
      }
      return msatsToSats(BigInt(item.downMsats) + BigInt(item.mePendingDontLikeMsats || 0))
    },
    commentDownSats: async (item, args, { models }) => {
      return msatsToSats(item.commentDownMsats)
    },
    boost: async (item, args, { models, me }) => {
      if (me?.id !== item.userId) {
        return item.boost + item.oldBoost
      }
      return (item.boost + item.oldBoost) + msatsToSats(BigInt(item.mePendingBoostMsats || 0))
    },
    credits: async (item, args, { models, me }) => {
      if (me?.id === item.userId) {
        return msatsToSats(BigInt(item.mcredits))
      }
      return msatsToSats(BigInt(item.mcredits) + BigInt(item.mePendingMcredits || 0))
    },
    commentSats: async (item, args, { models }) => {
      return msatsToSats(item.commentMsats)
    },
    commentCredits: async (item, args, { models }) => {
      return msatsToSats(item.commentMcredits)
    },
    isJob: async (item, args, { models }) => {
      return item.subNames?.includes('jobs') ?? false
    },
    sub: async (item, args, { models }) => {
      if (!item.subNames?.length && !item.root?.subNames?.length) {
        return null
      }
      return item.subs?.[0] || item.root?.subs?.[0] ||
        await models.sub.findUnique({ where: { name: item.subNames?.[0] ?? item.root?.subNames?.[0] } })
    },
    subName: async (item, args, { models }) => {
      return item.subNames?.[0]
    },
    subs: async (item, args, { models }) => {
      if (!item.subNames?.length && !item.root) {
        return null
      }

      if (item.subs) {
        return item.subs
      }

      return await models.sub.findMany({ where: { name: { in: item.subNames || item.root?.subNames } } })
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

      // votes that are paid for have a null payInId
      const options = await models.$queryRaw`
        SELECT "PollOption".id, option, count("PollVote".id) FILTER (WHERE "PollVote"."payInId" IS NULL)::INTEGER as count
        FROM "PollOption"
        LEFT JOIN "PollVote" on "PollVote"."pollOptionId" = "PollOption".id
        WHERE "PollOption"."itemId" = ${item.id}
        GROUP BY "PollOption".id
        ORDER BY "PollOption".id ASC
      `

      const poll = {}
      if (me) {
        const meVoted = await models.payIn.findFirst({
          where: {
            userId: me.id,
            payInType: 'POLL_VOTE',
            payInState: 'PAID',
            itemPayIn: {
              itemId: item.id
            }
          }
        })
        poll.meVoted = !!meVoted
      } else {
        poll.meVoted = false
      }

      poll.randPollOptions = item?.randPollOptions
      poll.options = poll.randPollOptions ? shuffleArray(options) : options
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
    comments: async (item, { sort, cursor }, { me, models }) => {
      if (typeof item.comments !== 'undefined') {
        if (Array.isArray(item.comments)) {
          return {
            comments: item.comments,
            cursor: null
          }
        }
        return item.comments
      }

      // if we're logged in, there might be pending comments from us we want to show but weren't counted
      if (!me && item.ncomments === 0) {
        return {
          comments: [],
          cursor: null
        }
      }

      return comments(me, models, item, sort || defaultCommentSort(item.pinId, item.bioId, item.createdAt), cursor)
    },
    freedFreebie: async (item) => {
      return item.weightedVotes - item.weightedDownVotes > 0
    },
    freebie: async (item) => {
      return item.cost === 0 && item.boost === 0
    },
    netInvestment: async (item) => {
      // Maintained by the item_net_investment trigger
      return item.netInvestment ?? 0
    },
    meSats: async (item, args, { me, models }) => {
      if (!me) return 0
      if (typeof item.meMsats !== 'undefined' && typeof item.meMcredits !== 'undefined') {
        return msatsToSats(BigInt(item.meMsats) + BigInt(item.meMcredits))
      }

      const { _sum: { mcost } } = await models.payIn.aggregate({
        _sum: {
          mcost: true
        },
        where: {
          itemPayIn: {
            itemId: Number(item.id)
          },
          payInType: 'ZAP',
          userId: me.id,
          payInState: {
            not: 'FAILED'
          }
        }
      })

      return (mcost && msatsToSats(mcost)) || 0
    },
    meCredits: async (item, args, { me, models }) => {
      if (!me) return 0
      if (typeof item.meMcredits !== 'undefined') {
        return msatsToSats(item.meMcredits)
      }

      const { _sum: { mcost } } = await models.payIn.aggregate({
        _sum: {
          mcost: true
        },
        where: {
          payInType: 'ZAP',
          userId: me.id,
          payInState: {
            not: 'FAILED'
          },
          payOutBolt11: {
            is: null
          },
          itemPayIn: {
            itemId: Number(item.id)
          }
        }
      })

      return (mcost && msatsToSats(mcost)) || 0
    },
    meDontLikeSats: async (item, args, { me, models }) => {
      if (!me) return 0
      if (typeof item.meDontLikeMsats !== 'undefined') {
        return msatsToSats(item.meDontLikeMsats)
      }

      const { _sum: { mcost } } = await models.payIn.aggregate({
        _sum: {
          mcost: true
        },
        where: {
          payInType: 'DOWN_ZAP',
          userId: me.id,
          payInState: {
            not: 'FAILED'
          },
          itemPayIn: {
            itemId: Number(item.id)
          }
        }
      })

      return (mcost && msatsToSats(mcost)) || 0
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
    rel: async (item, args, { me, models }) => {
      // Use netInvestment for nofollow decision (items with low investment get nofollow)
      const netInvestment = item.netInvestment ?? 0
      return netInvestment < NOFOLLOW_LIMIT ? UNKNOWN_LINK_REL : 'noopener noreferrer'
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
            '"Item".id = $1')}`
      }, Number(item.rootId))

      return root
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
    },
    lexicalState: async (item, args, { lexicalStateLoader }) => {
      if (!item.text) return null
      return lexicalStateLoader.load({ text: item.text, context: { imgproxyUrls: item.imgproxyUrls, rel: item.rel } })
    },
    html: async (item, args, { lexicalStateLoader }) => {
      if (!item.text) return null
      try {
        const lexicalState = await lexicalStateLoader.load({ text: item.text, context: { imgproxyUrls: item.imgproxyUrls, rel: item.rel } })
        if (!lexicalState) return null
        return lexicalHTMLGenerator(lexicalState)
      } catch (error) {
        console.error('error generating HTML from Lexical State:', error)
        return null
      }
    }
  }
}

export const updateItem = async (parent, { forward, hash, hmac, ...item }, { me, models, lnd }) => {
  // update iff this item belongs to me
  const old = await models.item.findUnique({
    where: { id: Number(item.id) },
    include: {
      itemPayIns: {
        where: {
          payIn: {
            payInType: 'ITEM_CREATE',
            payInState: 'PAID'
          }
        },
        include: {
          payIn: {
            include: {
              payInBolt11: true
            }
          }
        }
      }
    }
  })

  if (old.deletedAt) {
    throw new GqlInputError('item is deleted')
  }

  const meId = Number(me?.id ?? USER_ID.anon)

  // author can edit their own item (except anon)
  const authorEdit = !!me && Number(old.userId) === meId
  // admins can edit special items
  const adminEdit = ADMIN_ITEMS.includes(old.id) && SN_ADMIN_IDS.includes(meId)
  // anybody can edit with valid hash+hmac
  let hmacEdit = false
  const payIn = old.itemPayIns[0]?.payIn
  if (payIn?.payInBolt11?.hash && hash && hmac) {
    hmacEdit = payIn.payInBolt11.hash === hash && verifyHmac(hash, hmac)
  }
  // ownership permission check
  const ownerEdit = authorEdit || adminEdit || hmacEdit
  if (!ownerEdit) {
    throw new GqlInputError('item does not belong to you')
  }

  // in case they lied about their existing boost
  await validateSchema(advSchema, { boost: item.boost }, { models, me, existingBoost: old.boost })

  const user = await models.user.findUnique({ where: { id: meId } })

  // edits are only allowed for own items within 10 minutes
  // but forever if an admin is editing an "admin item", it's their bio or a job
  const myBio = user.bioId === old.id
  const timer = Date.now() < datePivot(new Date(payIn?.payInStateChangedAt ?? old.createdAt), { seconds: ITEM_EDIT_SECONDS })
  const canEdit = payIn?.payInState !== 'PAID' || (timer && ownerEdit) || adminEdit || myBio || isJob(old)
  if (!canEdit) {
    throw new GqlInputError('item can no longer be edited')
  }

  if (item.url && !isJob(item)) {
    item.url = ensureProtocol(item.url)
    item.url = removeTracking(item.url)
  }

  if (old.bio) {
    // prevent editing a bio like a regular item
    item = { id: Number(item.id), text: item.text, title: `@${user.name}'s bio` }
  } else if (old.parentId) {
    // prevent editing a comment like a post
    item = { id: Number(item.id), text: item.text, boost: item.boost }
  } else {
    item.forwardUsers = await getForwardUsers(models, forward)
  }
  // note for the future: could also check MediaNodes directly via Lexical
  item.uploadIds = uploadIdsFromText(item.text)

  // never change author of item
  item.userId = old.userId

  return await pay('ITEM_UPDATE', item, { models, me, lnd })
}

export const createItem = async (parent, { forward, ...item }, { me, models, lnd }) => {
  item.userId = me ? Number(me.id) : USER_ID.anon

  item.forwardUsers = await getForwardUsers(models, forward)
  item.uploadIds = uploadIdsFromText(item.text)

  if (item.url && !isJob(item)) {
    item.url = ensureProtocol(item.url)
    item.url = removeTracking(item.url)
  }

  if (item.parentId) {
    const parent = await models.itemPayIn.findFirst({ where: { itemId: parseInt(item.parentId), payIn: { payInType: 'ITEM_CREATE', payInState: 'PAID' } } })
    if (!parent) {
      throw new GqlInputError('cannot comment on unpaid item')
    }
  }

  // mark item as created with API key
  item.apiKey = me?.apiKey

  return await pay('ITEM_CREATE', item, { models, me, lnd })
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
