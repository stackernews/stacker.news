import { ensureProtocol, removeTracking, stripTrailingSlash } from '@/lib/url'
import { snFetch } from '@/lib/fetch'
import { decodeCursor } from '@/lib/cursor'
import { getMetadata, metadataRuleSets } from 'page-metadata-parser'
import { ruleSet as publicationDateRuleSet } from '@/lib/timedate-scraper'
import domino from 'domino'
import {
  ITEM_SPAM_INTERVAL,
  COMMENT_TYPE_QUERY,
  USER_ID, POLL_COST, ADMIN_ITEMS,
  NOFOLLOW_LIMIT, UNKNOWN_LINK_REL, SN_ADMIN_IDS,
  ITEM_EDIT_SECONDS,
  WALLET_RETRY_BEFORE_MS,
  WALLET_MAX_RETRIES,
  DEFAULT_POSTS_SATS_FILTER,
  DEFAULT_COMMENTS_SATS_FILTER,
  HOMEPAGE_POSTS_SATS_FILTER
} from '@/lib/constants'
import { msatsToSats } from '@/lib/format'
import uu from 'url-unshort'
import { actSchema, bountySchema, commentSchema, discussionSchema, jobSchema, linkSchema, pollSchema, validateSchema } from '@/lib/validate'
import { defaultCommentSort, isJob, deleteItemByAuthor } from '@/lib/item'
import { datePivot, whenRange } from '@/lib/time'
import { uploadIdsFromText } from './upload'
import assertGofacYourself from './ofac'
import assertApiKeyNotPermitted from './apiKey'
import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { verifyHmac } from './wallet'
import { parse } from 'tldts'
import { shuffleArray } from '@/lib/rand'
import pay, { retry as retryPayIn } from '../payIn'
import { BOUNTY_ALREADY_PAID_ERROR, BOUNTY_IN_PROGRESS_ERROR, getBountyPaymentTail } from '../payIn/lib/bountyPayment'
import { lexicalHTMLGenerator } from '@/lib/lexical/server/html'
import { resolveItemComments } from './comment-tree'
import { encodeItemKeysetCursor, itemKeysetCursor, updateItemKeysetCursor } from './item-pagination'
import { Prisma } from '@prisma/client'

export async function getItem (parent, { id }, { me, models }) {
  const [item] = await getItemsById([id], { me, models })
  return item
}

export async function getItemsById (ids, { me, models }) {
  const uniqueIds = [...new Set(ids.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0))]
  if (uniqueIds.length === 0) return []

  const values = Prisma.join(uniqueIds.map((id, index) => Prisma.sql`(${id}::INTEGER, ${index}::INTEGER)`))
  const items = await itemQueryWithMeta({
    me,
    models,
    query: Prisma.sql`
      WITH requested(id, rank) AS (VALUES ${values})
      ${SELECT}, rank
      FROM "Item"
      JOIN requested ON "Item".id = requested.id
      ${whereSql(activeOrMineSql(me), paidItemSql(me))}`,
    orderBy: Prisma.sql`ORDER BY rank ASC`
  })

  return items.map(({ rank, ...item }) => item)
}

// this grabs all the stuff we need to display the item list and only
// hits the db once ... orderBy needs to be duplicated on the outer query because
// joining does not preserve the order of the inner query
export async function itemQueryWithMeta ({ me, models, query, orderBy = Prisma.empty }) {
  if (!me) {
    return await models.$queryRaw(Prisma.sql`
      SELECT "Item".*, to_json(users.*) as user, "subs".subs as subs, NULL::jsonb as "payIn"
      FROM (
        ${query}
      ) "Item"
      JOIN users ON "Item"."userId" = users.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(json_agg("Sub".*), '[]') as subs
        FROM "Sub"
        WHERE "Sub"."name" = ANY("Item"."subNames")
      ) "subs" ON true
      ${orderBy}`)
  } else {
    return await models.$queryRaw(Prisma.sql`
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
      LEFT JOIN "Mute" ON "Mute"."muterId" = ${me.id}::INTEGER AND "Mute"."mutedId" = "Item"."userId"
      LEFT JOIN "Bookmark" b ON b."itemId" = "Item".id AND b."userId" = ${me.id}::INTEGER
      LEFT JOIN "ThreadSubscription" ON "ThreadSubscription"."itemId" = "Item".id AND "ThreadSubscription"."userId" = ${me.id}::INTEGER
      LEFT JOIN "ItemForward" ON "ItemForward"."itemId" = "Item".id AND "ItemForward"."userId" = ${me.id}::INTEGER
      LEFT JOIN "CommentsViewAt" ON "CommentsViewAt"."itemId" = "Item".id AND "CommentsViewAt"."userId" = ${me.id}::INTEGER
      LEFT JOIN LATERAL (
        SELECT COALESCE(json_agg("Sub".*), '[]') as subs
        FROM (
          SELECT "Sub".*, "MuteSub"."userId" IS NOT NULL as "meMuteSub", "SubSubscription"."userId" IS NOT NULL as "meSubscription"
          FROM "Sub"
          LEFT JOIN "MuteSub" ON "Sub"."name" = "MuteSub"."subName" AND "MuteSub"."userId" = ${me.id}::INTEGER
          LEFT JOIN "SubSubscription" ON "Sub"."name" = "SubSubscription"."subName" AND "SubSubscription"."userId" = ${me.id}::INTEGER
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
        WHERE "PayIn"."userId" = ${me.id}::INTEGER
        AND "ItemPayIn"."itemId" = "Item".id
        AND (
          "PayIn"."payInState" = 'PAID'
          -- some kind of pending state
          OR "PayIn"."payInState" <> 'FAILED'
          OR (
            -- going to be retrying
            "PayIn"."payInState" = 'FAILED'
            AND "PayIn"."payInFailureReason" <> 'USER_CANCELLED'
            AND "PayIn"."payInStateChangedAt" > now() - ${`${WALLET_RETRY_BEFORE_MS} milliseconds`}::interval
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
        WHERE "ItemPayIn"."itemId" = "Item".id
          AND "Item"."userId" = ${me.id}::INTEGER
          AND "PayIn"."userId" = ${me.id}::INTEGER
          AND "PayIn"."successorId" IS NULL
        ORDER BY "PayIn"."created_at" DESC
        LIMIT 1
      ) "PayIn" ON "PayIn".id IS NOT NULL
      ${orderBy}`)
  }
}

const relationClause = (type) => {
  switch (type) {
    case 'bookmarks':
      return Prisma.sql`FROM "Item" JOIN "Bookmark" ON "Bookmark"."itemId" = "Item"."id" LEFT JOIN "Item" root ON "Item"."rootId" = root.id`
    case 'comments':
    case 'freebies':
    case 'desperados':
    case 'all':
      return Prisma.sql`FROM "Item" LEFT JOIN "Item" root ON "Item"."rootId" = root.id`
    default: // posts which are their own root
      return Prisma.sql`FROM "Item"`
  }
}

export const paidItemSql = me => me
  ? Prisma.sql`("Item"."paidAt" IS NOT NULL OR "Item"."userId" = ${me.id}::INTEGER)`
  : Prisma.sql`"Item"."paidAt" IS NOT NULL`

const selectClause = (type) => type === 'bookmarks'
  ? Prisma.sql`${SELECT}, "Bookmark"."created_at" as "bookmarkCreatedAt"`
  : SELECT

const subClauseTable = (type) => COMMENT_TYPE_QUERY.includes(type) ? 'root' : 'Item'

const itemSubSql = (sub, inheritFromRoot = false) => {
  // Posts own their territory memberships; comments inherit their root's.
  const itemId = inheritFromRoot
    ? Prisma.sql`COALESCE("Item"."rootId", "Item".id)`
    : Prisma.sql`"Item".id`

  return Prisma.sql`EXISTS (
    SELECT 1
    FROM "ItemSub"
    WHERE "ItemSub"."itemId" = ${itemId}
      AND "ItemSub"."subName" = ${sub}::CITEXT
  )`
}

export const whereSql = (...clauses) => {
  const clause = clauses.flat(Infinity).filter(Boolean)
  return clause.length
    ? Prisma.sql`WHERE ${Prisma.join(clause, ' AND ')}`
    : Prisma.empty
}

function whenSql ([from, to], table) {
  return table === 'Bookmark'
    ? Prisma.sql`"Bookmark".created_at <= ${to}::TIMESTAMP AND "Bookmark".created_at >= ${from}::TIMESTAMP`
    : Prisma.sql`"Item".created_at <= ${to}::TIMESTAMP AND "Item".created_at >= ${from}::TIMESTAMP`
}

export const activeOrMineSql = me => me
  ? Prisma.sql`("Item".status <> 'STOPPED' OR "Item"."userId" = ${me.id}::INTEGER)`
  : Prisma.sql`"Item".status <> 'STOPPED'`

export const muteSql = me => me
  ? Prisma.sql`NOT EXISTS (
      SELECT 1
      FROM "Mute"
      WHERE "Mute"."muterId" = ${me.id}::INTEGER
        AND "Mute"."mutedId" = "Item"."userId"
    )`
  : null

const subSql = (sub, table = 'Item', me, showNsfw) => {
  // Intentionally show nsfw posts (i.e. no nsfw clause) when viewing a specific nsfw sub
  if (sub) {
    return itemSubSql(sub, table === 'root')
  }

  // XXX heh, we don't have any nsfw subs so we don't need to hide them
  const hideNsfwClause = undefined // `NOT EXISTS (SELECT 1 FROM "Sub" WHERE "Sub"."name" = ANY(${table ? `"${table}".` : ''}"subNames") AND "Sub"."nsfw" = TRUE)`

  if (!me) { return hideNsfwClause }

  const subNames = table === 'root'
    ? Prisma.sql`root."subNames"`
    : Prisma.sql`"Item"."subNames"`
  const excludeMuted = Prisma.sql`NOT EXISTS (
    SELECT 1
    FROM "MuteSub"
    WHERE "MuteSub"."userId" = ${me.id}::INTEGER
      AND "MuteSub"."subName" = ANY(${subNames})
  )`
  if (showNsfw) return excludeMuted

  return excludeMuted
}

function invertedInvestmentSql (postsSatsFilter, commentsSatsFilter) {
  if (postsSatsFilter == null && commentsSatsFilter == null) {
    return Prisma.sql`FALSE`
  }

  const postsExpr = postsSatsFilter == null
    ? Prisma.sql`FALSE`
    : Prisma.sql`"Item"."netInvestment" < ${postsSatsFilter}::INTEGER`
  const commentsExpr = commentsSatsFilter == null
    ? Prisma.sql`FALSE`
    : Prisma.sql`"Item"."netInvestment" < ${commentsSatsFilter}::INTEGER`

  return Prisma.sql`(
    CASE WHEN "Item"."parentId" IS NULL
      THEN ${postsExpr}
      ELSE ${commentsExpr}
    END
  )`
}

function investmentSql (postsSatsFilter, commentsSatsFilter, meId, ownerBypass) {
  if (postsSatsFilter == null && commentsSatsFilter == null) {
    return null
  }

  const postsExpr = postsSatsFilter == null
    ? Prisma.sql`TRUE`
    : ownerBypass && meId
      ? Prisma.sql`("Item"."netInvestment" >= ${postsSatsFilter}::INTEGER OR "Item"."userId" = ${meId}::INTEGER)`
      : Prisma.sql`"Item"."netInvestment" >= ${postsSatsFilter}::INTEGER`
  const commentsExpr = commentsSatsFilter == null
    ? Prisma.sql`TRUE`
    : ownerBypass && meId
      ? Prisma.sql`("Item"."netInvestment" >= ${commentsSatsFilter}::INTEGER OR "Item"."userId" = ${meId}::INTEGER)`
      : Prisma.sql`"Item"."netInvestment" >= ${commentsSatsFilter}::INTEGER`

  return Prisma.sql`(
    CASE WHEN "Item"."parentId" IS NULL
      THEN ${postsExpr}
      ELSE ${commentsExpr}
    END
  )`
}

async function investmentFilter (type, sub, sort, { me, userLoader, subLoader }, by) {
  if (type === 'freebies' || type === 'bios' || by === 'downsats') {
    return null
  }

  const isDesperados = type === 'desperados'

  let postsSatsFilter = DEFAULT_POSTS_SATS_FILTER
  let commentsSatsFilter = DEFAULT_COMMENTS_SATS_FILTER
  const isCurated = sort === 'lit' || sort === 'top'

  if (me) {
    const user = await userLoader.load(me.id)
    commentsSatsFilter = user.commentsSatsFilter
    postsSatsFilter = user.postsSatsFilter
  }

  const territory = sub ? await subLoader.load(sub) : null

  if (sort === 'top' && me) {
    // top sort, logged in: user's own filter, no overrides
  } else if (territory && isCurated) {
    // lit (or top logged-out) in territory: territory is authoritative
    postsSatsFilter = territory.postsSatsFilter
  } else if (territory) {
    // non-curated in territory: most permissive of user/territory
    // null (show all) beats any number since it's conceptually -infinity
    postsSatsFilter = me
      ? (postsSatsFilter == null ? null : Math.min(postsSatsFilter, territory.postsSatsFilter))
      : territory.postsSatsFilter
  } else if (isCurated) {
    // homepage curated: enforce homepage minimum
    // null (show all) defers to the homepage threshold
    postsSatsFilter = postsSatsFilter == null
      ? HOMEPAGE_POSTS_SATS_FILTER
      : Math.max(postsSatsFilter, HOMEPAGE_POSTS_SATS_FILTER)
  }

  return { commentsSatsFilter, isCurated, isDesperados, postsSatsFilter }
}

export async function filterSql (type, sub, sort, ctx, by) {
  const filter = await investmentFilter(type, sub, sort, ctx, by)
  if (!filter) return null

  const { commentsSatsFilter, isCurated, isDesperados, postsSatsFilter } = filter
  if (isDesperados) {
    return invertedInvestmentSql(postsSatsFilter, commentsSatsFilter)
  }
  return investmentSql(postsSatsFilter, commentsSatsFilter, ctx.me?.id, !isCurated)
}

function typeFilterSql (type) {
  switch (type) {
    case 'links':
      return [Prisma.sql`"Item".url IS NOT NULL`, Prisma.sql`"Item"."parentId" IS NULL`]
    case 'discussions':
      return [Prisma.sql`"Item".url IS NULL`, Prisma.sql`"Item".bio = false`, Prisma.sql`"Item"."pollCost" IS NULL`, Prisma.sql`"Item"."parentId" IS NULL`]
    case 'polls':
      return [Prisma.sql`"Item"."pollCost" IS NOT NULL`, Prisma.sql`"Item"."parentId" IS NULL`]
    case 'bios':
      return [Prisma.sql`"Item".bio = true`, Prisma.sql`"Item"."parentId" IS NULL`]
    case 'bounties':
      return [Prisma.sql`"Item".bounty IS NOT NULL`, Prisma.sql`"Item"."parentId" IS NULL`]
    case 'bounties_active':
      return [Prisma.sql`"Item".bounty IS NOT NULL`, Prisma.sql`"Item"."parentId" IS NULL`, Prisma.sql`"Item"."bountyPaidTo" IS NULL`]
    case 'comments':
      return Prisma.sql`"Item"."parentId" IS NOT NULL`
    case 'freebies':
      return Prisma.sql`"Item".freebie = true`
    case 'desperados':
    case 'all':
    case 'bookmarks':
      return null
    case 'jobs':
      return Prisma.sql`"Item"."subNames" @> ARRAY['jobs']`
    default:
      return Prisma.sql`"Item"."parentId" IS NULL`
  }
}

function itemSortSql (by, type) {
  switch (by) {
    case 'comments':
      return { expression: Prisma.sql`"Item".ncomments`, cast: Prisma.raw('INTEGER') }
    case 'sats':
      return { expression: Prisma.sql`"Item".ranktop`, cast: Prisma.raw('DOUBLE PRECISION') }
    case 'downsats':
      return { expression: Prisma.sql`"Item"."downMsats"`, cast: Prisma.raw('BIGINT') }
    default:
      return {
        expression: type === 'bookmarks'
          ? Prisma.sql`"Bookmark".created_at`
          : Prisma.sql`"Item".created_at`,
        cast: Prisma.raw('TIMESTAMP')
      }
  }
}

const ITEM_KEYSET_ORDER = Prisma.sql`ORDER BY "cursorSort" DESC, "Item".id DESC`

export default {
  Query: {
    itemRepetition: async (parent, { parentId }, { me, models }) => {
      if (!me) return 0
      // how many of the parents starting at parentId belong to me
      const [{ item_spam: count }] = await models.$queryRawUnsafe(`SELECT item_spam($1::INTEGER, $2::INTEGER, '${ITEM_SPAM_INTERVAL}')`,
        Number(parentId), Number(me.id))

      return count
    },
    items: async (parent, { sub, sort, type, cursor, name, when, from, to, by, limit }, ctx) => {
      const { me, models, userLoader } = ctx
      const decodedCursor = decodeCursor(cursor)
      let items, user, pins, table

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

      const currentUser = me ? await userLoader.load(me.id) : null
      const showNsfw = currentUser ? currentUser.nsfwMode : false

      switch (sort) {
        case 'user': {
          if (!name) {
            throw new GqlInputError('must supply name')
          }

          user ??= await models.user.findUnique({ where: { name } })
          if (!user) {
            throw new GqlInputError('no user has that name')
          }

          table = type === 'bookmarks' ? 'Bookmark' : 'Item'
          const sortSql = itemSortSql(by, type)
          const keyset = itemKeysetCursor(cursor, decodedCursor)
          const cursorFilterSql = keyset
            ? Prisma.sql`(${sortSql.expression}, "Item".id) < (${keyset.key}::${sortSql.cast}, ${keyset.id}::INTEGER)`
            : null
          const userClause = table === 'Bookmark'
            ? Prisma.sql`"Bookmark"."userId" = ${user.id}::INTEGER`
            : Prisma.sql`"Item"."userId" = ${user.id}::INTEGER`
          items = await itemQueryWithMeta({
            me,
            models,
            query: Prisma.sql`
              ${selectClause(type)}, ${sortSql.expression} AS "cursorSort"
              ${relationClause(type)}
              ${whereSql(
                userClause,
                paidItemSql(me),
                activeOrMineSql(me),
                typeFilterSql(type),
                by === 'downsats' && Prisma.sql`"Item"."downMsats" > 0`,
                whenSql(whenRange(when, from, to || decodedCursor.time), table),
                cursorFilterSql)}
              ${ITEM_KEYSET_ORDER}
              LIMIT ${limit}::INTEGER`,
            orderBy: ITEM_KEYSET_ORDER
          })

          updateItemKeysetCursor(decodedCursor, items, limit)
          break
        }
        case 'new': {
          const keyset = itemKeysetCursor(cursor, decodedCursor)
          const cursorSortSql = Prisma.sql`COALESCE("Item"."paidAt", "Item".created_at)`
          const cursorFilterSql = keyset
            ? Prisma.sql`(${cursorSortSql}, "Item".id) < (${keyset.key}::TIMESTAMP, ${keyset.id}::INTEGER)`
            : null

          items = await itemQueryWithMeta({
            me,
            models,
            query: Prisma.sql`
              ${SELECT}, ${cursorSortSql} AS "cursorSort"
              ${relationClause(type)}
              ${whereSql(
                Prisma.sql`"Item".created_at <= ${decodedCursor.time}::TIMESTAMP`,
                Prisma.sql`"Item"."deletedAt" IS NULL`,
                paidItemSql(me),
                subSql(sub, subClauseTable(type), me, showNsfw),
                activeOrMineSql(me),
                await filterSql(type, sub, 'new', ctx),
                typeFilterSql(type),
                muteSql(me),
                cursorFilterSql
              )}
              ${ITEM_KEYSET_ORDER}
              LIMIT ${limit}::INTEGER`,
            orderBy: ITEM_KEYSET_ORDER
          })

          updateItemKeysetCursor(decodedCursor, items, limit)
          break
        }
        case 'top': {
          const sortSql = itemSortSql(by || 'sats', type)
          const keyset = itemKeysetCursor(cursor, decodedCursor)
          const cursorFilterSql = keyset
            ? Prisma.sql`(${sortSql.expression}, "Item".id) < (${keyset.key}::${sortSql.cast}, ${keyset.id}::INTEGER)`
            : null

          items = await itemQueryWithMeta({
            me,
            models,
            query: Prisma.sql`
              ${selectClause(type)}, ${sortSql.expression} AS "cursorSort"
              ${relationClause(type)}
              ${whereSql(
                Prisma.sql`"Item"."deletedAt" IS NULL`,
                paidItemSql(me),
                type === 'posts' && Prisma.sql`"Item"."subNames" IS NOT NULL`,
                subSql(sub, subClauseTable(type), me, showNsfw),
                typeFilterSql(type),
                whenSql(whenRange(when, from, to || decodedCursor.time), 'Item'),
                activeOrMineSql(me),
                Prisma.sql`"Item".status = 'ACTIVE'`,
                by === 'downsats' && Prisma.sql`"Item"."downMsats" > 0`,
                await filterSql(type, sub, 'top', ctx, by),
                muteSql(me),
                cursorFilterSql)}
              ${ITEM_KEYSET_ORDER}
              LIMIT ${limit}::INTEGER`,
            orderBy: ITEM_KEYSET_ORDER
          })

          updateItemKeysetCursor(decodedCursor, items, limit)
          break
        }
        default: {
          const keyset = itemKeysetCursor(cursor, decodedCursor)
          const cursorSortSql = Prisma.sql`"Item".ranklit`
          const cursorFilterSql = keyset
            ? Prisma.sql`(${cursorSortSql}, "Item".id) < (${keyset.key}::DOUBLE PRECISION, ${keyset.id}::INTEGER)`
            : null

          if (!cursor) {
            // get pins for the page and return those separately
            pins = await itemQueryWithMeta({
              me,
              models,
              query: Prisma.sql`
              SELECT rank_filter.*
                FROM (
                  ${SELECT}, position,
                  rank() OVER (
                      PARTITION BY "pinId"
                      ORDER BY "Item".created_at DESC
                  )
                  FROM "Item"
                  JOIN "Pin" ON "Item"."pinId" = "Pin".id
                  ${whereSql(
                    Prisma.sql`"pinId" IS NOT NULL`,
                    Prisma.sql`"parentId" IS NULL`,
                    paidItemSql(me),
                    sub
                      ? Prisma.sql`"Item"."subNames" @> ARRAY[${sub}]::CITEXT[]`
                      : Prisma.sql`"Item"."subNames" IS NULL`,
                    muteSql(me))}
              ) rank_filter WHERE RANK = 1
              ORDER BY position ASC`,
              orderBy: Prisma.sql`ORDER BY position ASC`
            })
          }

          items = await itemQueryWithMeta({
            me,
            models,
            query: Prisma.sql`
                ${SELECT}, ${cursorSortSql} AS "cursorSort"
                FROM "Item"
                ${whereSql(
                  // in home (sub undefined), filter out global pinned items since we inject them later
                  sub
                    ? Prisma.sql`"Item"."pinId" IS NULL`
                    : Prisma.sql`NOT ("Item"."pinId" IS NOT NULL AND "Item"."subNames" IS NULL)`,
                  Prisma.sql`"Item"."deletedAt" IS NULL`,
                  Prisma.sql`"Item"."parentId" IS NULL`,
                  Prisma.sql`"Item".bio = false`,
                  paidItemSql(me),
                  activeOrMineSql(me),
                  Prisma.sql`"Item".status = 'ACTIVE'`,
                  await filterSql(type, sub, 'lit', ctx),
                  subSql(sub, 'Item', me, showNsfw),
                  muteSql(me),
                  cursorFilterSql)}
                ${ITEM_KEYSET_ORDER}
                LIMIT ${limit}::INTEGER`,
            orderBy: ITEM_KEYSET_ORDER
          })

          updateItemKeysetCursor(decodedCursor, items, limit)
          break
        }
      }
      return {
        cursor: items.length === limit ? encodeItemKeysetCursor(decodedCursor) : null,
        items,
        pins
      }
    },
    item: getItem,
    pageTitleAndUnshorted: async (parent, { url }, { models }) => {
      const res = {}
      try {
        const response = await snFetch(url, { protocol: 'http', redirect: 'follow', size: 2 * 1024 * 1024 })
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
        query: Prisma.sql`
          ${SELECT}
          FROM "Item"
          ${whereSql(Prisma.sql`url ~* ${similar}`, paidItemSql(me))}
          ORDER BY created_at DESC
          LIMIT 3`
      })
    },
    newComments: async (parent, { itemId, after }, { models, me }) => {
      const id = Number(itemId)
      const comments = await itemQueryWithMeta({
        me,
        models,
        query: Prisma.sql`
          ${SELECT}
          FROM "Item"
          -- comments can be nested, so we need to get all comments that are descendants of the root
          ${whereSql(
            Prisma.sql`"Item".path <@ (
              SELECT path
              FROM "Item"
              WHERE id = ${id}::INTEGER
                AND "Item"."lastCommentAt" > ${after}::TIMESTAMP
            )`,
            paidItemSql(me),
            activeOrMineSql(me),
            Prisma.sql`"Item"."created_at" > ${after}::TIMESTAMP`
          )}
          ORDER BY "Item"."created_at" ASC`
      })

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

      const pinScope = item.parentId
        ? Prisma.sql`i."parentId" = ${item.parentId}::INTEGER`
        : Prisma.sql`i."subNames" @> ARRAY[${item.subNames[0]}]::CITEXT[]`

      let pinId
      if (item.pinId) {
        // item is already pinned. remove pin
        await models.$transaction([
          models.item.update({ where: { id: item.id }, data: { pinId: null } }),
          models.pin.delete({ where: { id: item.pinId } }),
          // make sure that pins have no gaps
          models.$executeRaw(Prisma.sql`
            UPDATE "Pin"
            SET position = position - 1
            WHERE position > ${item.pin.position}::INTEGER AND id IN (
              SELECT "pinId" FROM "Item" i
              ${whereSql(Prisma.sql`"pinId" IS NOT NULL`, pinScope)}
            )`)
        ])

        pinId = null
      } else {
        // only max 3 pins allowed per territory and post
        const [{ count: npins }] = await models.$queryRaw(Prisma.sql`
          SELECT COUNT(p.id)
          FROM "Pin" p
          JOIN "Item" i ON i."pinId" = p.id
          ${whereSql(pinScope)}`)

        if (npins >= 3) {
          throw new GqlInputError('max 3 pins allowed')
        }

        const [{ pinId: newPinId }] = await models.$queryRaw(Prisma.sql`
          WITH pin AS (
            INSERT INTO "Pin" (position)
            SELECT COALESCE(MAX(p.position), 0) + 1 AS position
            FROM "Pin" p
            JOIN "Item" i ON i."pinId" = p.id
            ${whereSql(pinScope)}
            RETURNING id
          )
          UPDATE "Item"
          SET "pinId" = pin.id
          FROM pin
          WHERE "Item".id = ${item.id}::INTEGER
          RETURNING "pinId"`)

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
    upsertComment: async (parent, { id, useFreebie, ...item }, { me, models, lnd }) => {
      await validateSchema(commentSchema, item)

      if (id) {
        return await updateItem(parent, { id, ...item }, { me, models, lnd })
      } else {
        return await createItem(parent, { ...item, useFreebie }, { me, models, lnd })
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
    pollVote: async (parent, { id, sendProtocolId }, { me, models, lnd }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      return await pay('POLL_VOTE', { id }, { me, models, sendProtocolId })
    },
    act: async (parent, { id, sats, act = 'TIP', hasSendWallet, sendProtocolId }, { me, models, lnd, headers }) => {
      assertApiKeyNotPermitted({ me })
      await validateSchema(actSchema, { sats, act })
      await assertGofacYourself({ models, headers })

      const item = await models.item.findUnique({ where: { id: Number(id) } })

      if (!item?.paidAt) {
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
        return await pay('ZAP', { id, sats, hasSendWallet }, { me, models, sendProtocolId })
      } else if (act === 'DONT_LIKE_THIS') {
        return await pay('DOWN_ZAP', { id, sats }, { me, models, sendProtocolId })
      } else if (act === 'BOOST') {
        return await pay('BOOST', { id, sats }, { me, models, sendProtocolId })
      } else {
        throw new GqlInputError('unknown act')
      }
    },
    payBounty: async (parent, { id, sendProtocolId }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }
      assertApiKeyNotPermitted({ me })

      const item = await models.item.findUnique({ where: { id: Number(id) } })

      if (!item) {
        throw new GqlInputError('item not found')
      }

      if (!item.paidAt) {
        throw new GqlInputError('cannot pay bounty on unpaid item')
      }

      if (item.deletedAt) {
        throw new GqlInputError('item is deleted')
      }

      if (Number(item.userId) === Number(me.id)) {
        throw new GqlInputError('cannot pay bounty to yourself')
      }

      const tail = await getBountyPaymentTail(models, Number(id), { userId: Number(me.id) })
      if (!tail) {
        return await pay('BOUNTY_PAYMENT', { id }, { me, models, sendProtocolId })
      }
      if (tail.payInState === 'FAILED') {
        return await retryPayIn(tail.id, { me, sendProtocolId })
      }
      if (tail.payInState === 'PAID') {
        throw new GqlInputError(BOUNTY_ALREADY_PAID_ERROR)
      }
      throw new GqlInputError(BOUNTY_IN_PROGRESS_ERROR)
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
    payIn: async (item, args, { models, me }) => {
      if (!me) {
        if (Number(item.userId) !== USER_ID.anon) return null
        return item.payIn ?? null
      }

      if (Number(me.id) !== Number(item.userId)) {
        return null
      }

      if (typeof item.payIn !== 'undefined') {
        return item.payIn
      }

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
        return item.boost
      }
      return item.boost + msatsToSats(BigInt(item.mePendingBoostMsats || 0))
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
    bountyPaidTo: async (item, args, { models, me }) => {
      if (!me || !item.bounty || item.userId !== me.id) return item.bountyPaidTo

      const pendingPayments = await models.$queryRawUnsafe(`
        SELECT "ItemPayIn"."itemId"
        FROM "ItemPayIn"
        JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId"
        JOIN "Item" ON "Item".id = "ItemPayIn"."itemId"
        WHERE "PayIn"."payInType" = 'BOUNTY_PAYMENT'
        AND "PayIn"."userId" = $1
        AND "Item"."rootId" = $2
        AND (
          "PayIn"."payInState" <> 'FAILED'
          OR (
            "PayIn"."payInState" = 'FAILED'
            AND "PayIn"."payInFailureReason" <> 'USER_CANCELLED'
            AND "PayIn"."payInStateChangedAt" > now() - '${WALLET_RETRY_BEFORE_MS} milliseconds'::interval
            AND "PayIn"."retryCount" < ${WALLET_MAX_RETRIES}::integer
            AND "PayIn"."successorId" IS NULL
          )
        )
        AND "PayIn"."payInState" <> 'PAID'
      `, me.id, item.id)

      if (!pendingPayments.length) return item.bountyPaidTo

      const pendingIds = pendingPayments.map(p => p.itemId)
      const merged = [...new Set([...(item.bountyPaidTo || []), ...pendingIds])]
      return merged.length ? merged : null
    },
    commentCost: async (item) => item.commentCost || 0,
    commentBoost: async (item) => item.commentBoost || 0,
    isJob: async (item, args, { models }) => {
      return item.subNames?.includes('jobs') ?? false
    },
    sub: async (item, args, { models, subLoader }) => {
      if (!item.subNames?.length && !item.root?.subNames?.length) {
        return null
      }
      return item.subs?.[0] || item.root?.subs?.[0] ||
        await subLoader.load(item.subNames?.[0] ?? item.root?.subNames?.[0])
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
    comments: async (item, { sort, cursor }, ctx) => {
      const { me } = ctx
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

      return await resolveItemComments(item, sort || defaultCommentSort(item.pinId, item.bioId, item.createdAt), cursor, { ...ctx, itemQueryWithMeta, paidItemSql, select: SELECT })
    },
    freedFreebie: async (item) => {
      return item.weightedVotes - item.weightedDownVotes > 0
    },
    freebie: async (item) => {
      return item.cost === 0
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

      // we can't use getItem because the active-or-owner filter will prevent root from being fetched
      const [root] = await itemQueryWithMeta({
        me,
        models,
        query: Prisma.sql`
          ${SELECT}
          FROM "Item"
          ${whereSql(Prisma.sql`"Item".id = ${Number(item.rootId)}::INTEGER`)}`
      })

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
      return lexicalStateLoader.load({
        text: item.text,
        context: {
          imgproxyUrls: item.imgproxyUrls,
          rel: item.rel,
          userId: item.userId,
          parentId: item.parentId,
          netInvestment: item.netInvestment
        }
      })
    },
    html: async (item, args, { lexicalStateLoader }) => {
      if (!item.text) return null
      try {
        const lexicalState = await lexicalStateLoader.load({
          text: item.text,
          context: {
            imgproxyUrls: item.imgproxyUrls,
            rel: item.rel,
            userId: item.userId,
            parentId: item.parentId,
            netInvestment: item.netInvestment
          }
        })
        if (!lexicalState) return null
        return lexicalHTMLGenerator(lexicalState)
      } catch (error) {
        console.error('error generating HTML from Lexical State:', error)
        return null
      }
    }
  }
}

export const updateItem = async (parent, { forward, hash, hmac, sendProtocolId, ...item }, { me, models, lnd }) => {
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

  const user = await models.user.findUnique({ where: { id: meId } })

  // edits are only allowed for own items within 10 minutes
  // but forever if an admin is editing an "admin item", it's their bio or a job
  const myBio = user.bioId === old.id
  const timer = Date.now() < datePivot(new Date(old.paidAt ?? old.createdAt), { seconds: ITEM_EDIT_SECONDS })
  const canEdit = !old.paidAt || (timer && ownerEdit) || adminEdit || myBio || isJob(old)
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
    item = { id: Number(item.id), text: item.text }
  } else {
    item.forwardUsers = await getForwardUsers(models, forward)
  }
  // note for the future: could also check MediaNodes directly via Lexical
  item.uploadIds = uploadIdsFromText(item.text)

  // never change author of item
  item.userId = old.userId

  return await pay('ITEM_UPDATE', item, { models, me, lnd, sendProtocolId })
}

export const createItem = async (parent, { forward, sendProtocolId, ...item }, { me, models, lnd }) => {
  item.userId = me ? Number(me.id) : USER_ID.anon

  item.forwardUsers = await getForwardUsers(models, forward)
  item.uploadIds = uploadIdsFromText(item.text)

  if (item.url && !isJob(item)) {
    item.url = ensureProtocol(item.url)
    item.url = removeTracking(item.url)
  }

  if (item.parentId) {
    const parent = await models.item.findUnique({
      where: { id: parseInt(item.parentId) },
      select: { paidAt: true }
    })
    if (!parent?.paidAt) {
      throw new GqlInputError('cannot comment on unpaid item')
    }
  }

  // mark item as created with API key
  item.apiKey = me?.apiKey

  return await pay('ITEM_CREATE', item, { models, me, lnd, sendProtocolId })
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
  Prisma.sql`SELECT "Item".*, "Item".created_at as "createdAt", "Item".updated_at as "updatedAt",
    ltree2text("Item"."path") AS "path"`
