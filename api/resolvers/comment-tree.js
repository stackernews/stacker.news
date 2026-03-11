import {
  COMMENT_DEPTH_LIMIT,
  COMMENTS_LIMIT,
  COMMENTS_OF_COMMENT_LIMIT,
  DEFAULT_COMMENTS_SATS_FILTER,
  FULL_COMMENTS_THRESHOLD
} from '@/lib/constants'
import { decodeCursor, nextCursorEncoded } from '@/lib/cursor'

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
    '("Item"."pinId" IS NOT NULL) DESC',
    '("Item"."deletedAt" IS NULL) DESC',
    commentsSatsFilter != null &&
      `(CASE WHEN "Item"."netInvestment" < ${commentsSatsFilter} THEN 1 ELSE 0 END) ASC`
  ].filter(Boolean).join(', ')

  const sortExpr = sort === 'new'
    ? '"Item".created_at DESC'
    : sort === 'lit'
      ? '"Item"."ranklit" DESC'
      : '"Item"."ranktop" DESC'

  return `${sharedSorts}, ${sortExpr}, "Item".id DESC`
}

async function fetchFullCommentRows ({ itemId, me, models, sortClause, decodedCursor, itemQueryWithMeta, payInJoinFilter, select }) {
  const query = `
    WITH root AS (
      SELECT path, nlevel(path) AS depth
      FROM "Item"
      WHERE id = $1
    )
    ${select}
    FROM "Item"
    JOIN root ON true
    ${payInJoinFilter(me)}
    WHERE "Item".id <> $1
      AND "Item"."path" <@ root.path
      AND nlevel("Item"."path") - root.depth <= $3
      AND ("Item"."parentId" <> $1 OR "Item".created_at <= $2)
  `

  return await itemQueryWithMeta(
    { me, models, query, orderBy: `ORDER BY ${sortClause}` },
    itemId,
    decodedCursor.time,
    COMMENT_DEPTH_LIMIT
  )
}

async function fetchLimitedCommentRows ({ itemId, me, models, sortClause, decodedCursor, itemQueryWithMeta, payInJoinFilter, select }) {
  const query = `
    WITH RECURSIVE base AS (
      (
        SELECT
          "Item".id,
          1 AS depth,
          0::BIGINT AS rn
        FROM "Item"
        ${payInJoinFilter(me)}
        WHERE "Item"."parentId" = $1
          AND "Item".created_at <= $2
        ORDER BY ${sortClause}
        LIMIT $3
        OFFSET $4
      )
      UNION ALL
      (
        SELECT
          "Item".id,
          base.depth + 1 AS depth,
          ROW_NUMBER() OVER (PARTITION BY "Item"."parentId" ORDER BY ${sortClause}) AS rn
        FROM "Item"
        JOIN base ON "Item"."parentId" = base.id
        ${payInJoinFilter(me)}
        WHERE base.depth < $6
          AND (base.depth = 1 OR base.rn <= $5)
      )
    ),
    visible AS (
      SELECT id, depth, rn
      FROM base
      WHERE depth = 1 OR rn <= $5 - depth + 2
    )
    ${select}
    FROM visible
    JOIN "Item" ON "Item".id = visible.id
  `

  return await itemQueryWithMeta(
    { me, models, query, orderBy: `ORDER BY ${sortClause}` },
    itemId,
    decodedCursor.time,
    COMMENTS_LIMIT,
    decodedCursor.offset,
    COMMENTS_OF_COMMENT_LIMIT,
    LIMITED_COMMENT_DEPTH
  )
}

async function fetchComments ({ item, me, models, sortClause, decodedCursor, itemQueryWithMeta, payInJoinFilter, select }) {
  const rows = item.ncomments > FULL_COMMENTS_THRESHOLD
    ? await fetchLimitedCommentRows({ itemId: Number(item.id), me, models, sortClause, decodedCursor, itemQueryWithMeta, payInJoinFilter, select })
    : await fetchFullCommentRows({ itemId: Number(item.id), me, models, sortClause, decodedCursor, itemQueryWithMeta, payInJoinFilter, select })

  return buildCommentTree(rows, { rootId: Number(item.id) })
}

export async function resolveItemComments (item, sort, cursor, { me, models, userLoader, itemQueryWithMeta, payInJoinFilter, select }) {
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
  const comments = await fetchComments({ item, me, models, sortClause, decodedCursor, itemQueryWithMeta, payInJoinFilter, select })

  return {
    comments,
    cursor: comments.length + decodedCursor.offset < item.nDirectComments
      ? nextCursorEncoded(decodedCursor, COMMENTS_LIMIT)
      : null
  }
}
