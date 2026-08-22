import {
  COMMENT_DEPTH_LIMIT,
  COMMENTS_LIMIT,
  COMMENTS_OF_COMMENT_LIMIT,
  DEFAULT_COMMENTS_SATS_FILTER,
  FULL_COMMENTS_THRESHOLD
} from '@/lib/constants'
import { decodeCursor, nextCursorEncoded } from '@/lib/cursor'
import { Prisma } from '@prisma/client'

const LIMITED_COMMENT_DEPTH = Math.min(COMMENT_DEPTH_LIMIT, COMMENTS_OF_COMMENT_LIMIT + 1)

export function buildCommentTree (rows, { rootId }) {
  const byId = new Map(rows.map(row => {
    const { comments, ...comment } = row
    return [comment.id, { ...comment, comments: [] }]
  }))

  const comments = []

  for (const row of rows) {
    const comment = byId.get(row.id)

    if (comment.parentId === rootId) {
      comments.push(comment)
      continue
    }

    const parent = byId.get(comment.parentId)
    if (!parent) {
      console.error(
        `[COMMENT TREE ERROR] skipping comment ${comment.id} for root ${rootId}: missing parent ${comment.parentId} in fetched rows`
      )
      continue
    }

    parent.comments.push(comment)
  }

  return comments
}

function commentsSortClause (sort, commentsSatsFilter = DEFAULT_COMMENTS_SATS_FILTER) {
  const sharedSorts = [
    Prisma.sql`("Item"."pinId" IS NOT NULL) DESC`,
    Prisma.sql`("Item"."deletedAt" IS NULL) DESC`,
    commentsSatsFilter != null &&
      Prisma.sql`(CASE WHEN "Item"."netInvestment" < ${commentsSatsFilter}::INTEGER THEN 1 ELSE 0 END) ASC`
  ].filter(Boolean)

  const sortExpr = sort === 'new'
    ? Prisma.sql`"Item".created_at DESC`
    : sort === 'lit'
      ? Prisma.sql`"Item"."ranklit" DESC`
      : Prisma.sql`"Item"."ranktop" DESC`

  return Prisma.join([...sharedSorts, sortExpr, Prisma.sql`"Item".id DESC`], ', ')
}

async function fetchFullCommentRows ({ itemId, me, models, sortClause, decodedCursor, itemQueryWithMeta, paidItemSql, select }) {
  const query = Prisma.sql`
    WITH root AS (
      SELECT path, nlevel(path) AS depth
      FROM "Item"
      WHERE id = ${itemId}::INTEGER
    )
    ${select}
    FROM "Item"
    JOIN root ON true
    WHERE "Item".id <> ${itemId}::INTEGER
      AND ${paidItemSql(me)}
      AND "Item"."path" <@ root.path
      AND nlevel("Item"."path") - root.depth <= ${COMMENT_DEPTH_LIMIT}::INTEGER
      AND ("Item"."parentId" <> ${itemId}::INTEGER OR "Item".created_at <= ${decodedCursor.time}::TIMESTAMP)
  `

  return await itemQueryWithMeta({
    me,
    models,
    query,
    orderBy: Prisma.sql`ORDER BY ${sortClause}`
  })
}

async function fetchLimitedCommentRows ({ itemId, me, models, sortClause, decodedCursor, itemQueryWithMeta, paidItemSql, select }) {
  const query = Prisma.sql`
    WITH RECURSIVE base AS (
      (
        SELECT
          "Item".id,
          1 AS depth,
          0::BIGINT AS rn
        FROM "Item"
        WHERE "Item"."parentId" = ${itemId}::INTEGER
          AND ${paidItemSql(me)}
          AND "Item".created_at <= ${decodedCursor.time}::TIMESTAMP
        ORDER BY ${sortClause}
        LIMIT ${COMMENTS_LIMIT}::INTEGER
        OFFSET ${decodedCursor.offset}::INTEGER
      )
      UNION ALL
      (
        SELECT
          "Item".id,
          base.depth + 1 AS depth,
          ROW_NUMBER() OVER (PARTITION BY "Item"."parentId" ORDER BY ${sortClause}) AS rn
        FROM "Item"
        JOIN base ON "Item"."parentId" = base.id
        WHERE base.depth < ${LIMITED_COMMENT_DEPTH}::INTEGER
          AND ${paidItemSql(me)}
          AND (base.depth = 1 OR base.rn <= ${COMMENTS_OF_COMMENT_LIMIT}::INTEGER)
      )
    ),
    visible AS (
      SELECT id, depth, rn
      FROM base
      WHERE depth = 1 OR rn <= ${COMMENTS_OF_COMMENT_LIMIT}::INTEGER - depth + 2
    )
    ${select}
    FROM visible
    JOIN "Item" ON "Item".id = visible.id
  `

  return await itemQueryWithMeta({
    me,
    models,
    query,
    orderBy: Prisma.sql`ORDER BY ${sortClause}`
  })
}

async function fetchComments ({ item, me, models, sortClause, decodedCursor, itemQueryWithMeta, paidItemSql, select }) {
  const rows = item.ncomments > FULL_COMMENTS_THRESHOLD
    ? await fetchLimitedCommentRows({ itemId: Number(item.id), me, models, sortClause, decodedCursor, itemQueryWithMeta, paidItemSql, select })
    : await fetchFullCommentRows({ itemId: Number(item.id), me, models, sortClause, decodedCursor, itemQueryWithMeta, paidItemSql, select })

  return buildCommentTree(rows, { rootId: Number(item.id) })
}

export async function resolveItemComments (item, sort, cursor, { me, models, userLoader, itemQueryWithMeta, paidItemSql, select }) {
  let commentsSatsFilter = DEFAULT_COMMENTS_SATS_FILTER
  if (me) {
    const user = await userLoader.load(me.id)
    if (user) commentsSatsFilter = user.commentsSatsFilter
  }

  const sortClause = commentsSortClause(sort, commentsSatsFilter)

  if (!me && item.nDirectComments === 0) {
    return {
      comments: [],
      cursor: null
    }
  }

  const decodedCursor = decodeCursor(cursor)
  const comments = await fetchComments({ item, me, models, sortClause, decodedCursor, itemQueryWithMeta, paidItemSql, select })

  return {
    comments,
    cursor: comments.length + decodedCursor.offset < item.nDirectComments
      ? nextCursorEncoded(decodedCursor, COMMENTS_LIMIT)
      : null
  }
}
