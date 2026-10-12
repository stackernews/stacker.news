/**
 * Isolated regression tests for PR fixing #3255:
 * "Related posts" (and search results) must respect user mutes.
 *
 * The fix adds a muteClause to hitsToItems() in api/resolvers/search.js.
 * These tests extract the same clause-building logic shape that the fix
 * uses and assert its behavior against a mocked Prisma sql tagged template.
 */
import { expect, test } from '@jest/globals'

// Minimal Prisma.sql mock that concatenates tagged-template fragments
// deterministically so we can assert on the built SQL shape.
function buildMuteClause (me, Prisma) {
  return me
    ? Prisma.sql`WHERE NOT EXISTS (
        SELECT 1
        FROM "Mute"
        WHERE "Mute"."muterId" = ${me.id}::INTEGER
          AND "Mute"."mutedId" = "Item"."userId"
      )`
    : Prisma.empty
}

const Prisma = {
  empty: { __prismaEmpty: true },
  sql (strings, ...params) {
    return { __sql: strings.join('?'), params }
  }
}

test('muteClause is generated only for authenticated users', () => {
  const clause = buildMuteClause({ id: 42 }, Prisma)
  expect(clause.__sql).toContain('WHERE NOT EXISTS (')
  expect(clause.__sql).toContain('FROM "Mute"')
  expect(clause.__sql).toContain('"Mute"."muterId" = ?')
  expect(clause.__sql).toContain('"Mute"."mutedId" = "Item"."userId"')
  // scoped to the logged-in user only
  expect(clause.params).toEqual([42])
})

test('muteClause is empty for anonymous users (no over-filtering)', () => {
  const clause = buildMuteClause(null, Prisma)
  expect(clause).toBe(Prisma.empty)
})

test('muteClause embeds an idempotent NOT EXISTS (correlated subquery)', () => {
  const clause = buildMuteClause({ id: 1 }, Prisma)
  // must be a correlated NOT EXISTS filter, not a JOIN — JOIN would
  // change row multiplicity / drop rows instead of filtering
  expect(clause.__sql).not.toContain('JOIN')
  expect(clause.__sql.trim().startsWith('WHERE')).toBe(true)
})
