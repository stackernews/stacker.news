import { datePivot } from '@/lib/time'
import { HALLOWEEN_INACTIVITY_TIMEOUT_HOURS } from '@/lib/constants'
import { notifyInfected } from '@/lib/webPush'

export async function halloween ({ models }) {
  const inactiveUsers = await models.$queryRaw`
    WITH
        inactive_users AS (
            SELECT id FROM "users"
            WHERE id NOT IN (
                SELECT "userId" FROM "Item"
                WHERE created_at > ${datePivot(new Date(), { hours: -HALLOWEEN_INACTIVITY_TIMEOUT_HOURS })}
                AND ("invoiceActionState" IS NULL OR "invoiceActionState" = 'PAID')
            )
        ),
        new_infections AS (
            INSERT INTO "Infection" ("infecteeId")
            SELECT id FROM inactive_users
            ON CONFLICT ("infecteeId") DO NOTHING
            RETURNING "infecteeId"
        )
    UPDATE "users"
    SET infected = true
    WHERE id IN (SELECT "infecteeId" FROM new_infections)
    RETURNING id
  `

  await Promise.allSettled(
    inactiveUsers.map(user => notifyInfected(user.id).catch(console.error))
  )
}
