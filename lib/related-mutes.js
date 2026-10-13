import { Prisma } from '@prisma/client'

// Related posts are matched in OpenSearch and then hydrated from Postgres
// (hitsToItems). The index knows nothing about a stacker's mutes, so the
// hydration step is the only place they can be filtered: exclude posts whose
// author is muted and posts in muted territories. Mirrors muteSql() and the
// excludeMuted clause of subSql() in api/resolvers/item.js. Returns null for
// anonymous users, who have no mutes.
export function buildMuteFilter (me) {
  if (!me) return null

  return Prisma.sql`NOT EXISTS (
      SELECT 1
      FROM "Mute"
      WHERE "Mute"."muterId" = ${me.id}::INTEGER
        AND "Mute"."mutedId" = "Item"."userId"
    ) AND NOT EXISTS (
      SELECT 1
      FROM "MuteSub"
      WHERE "MuteSub"."userId" = ${me.id}::INTEGER
        AND "MuteSub"."subName" = ANY("Item"."subNames")
    )`
}
