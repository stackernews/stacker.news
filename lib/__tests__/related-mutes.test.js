/* eslint-env jest */

import { buildMuteFilter } from '../related-mutes'

describe('buildMuteFilter', () => {
  test('anonymous users get no filter (they have no mutes)', () => {
    expect(buildMuteFilter(null)).toBeNull()
    expect(buildMuteFilter(undefined)).toBeNull()
  })

  test('logged-in users get a Mute + MuteSub filter', () => {
    const sql = buildMuteFilter({ id: 42 })
    // Prisma.Sql tagged-template result: parameterized SQL in .sql, params in .values
    const text = sql.sql
    expect(text).toContain('"Mute"')
    expect(text).toContain('"MuteSub"')
    expect(text).toContain('"Item"."subNames"')
    // the user id is bound as a parameter, never interpolated into the SQL text
    expect(text).not.toContain('42')
    expect(sql.values).toEqual([42, 42])
  })
})
