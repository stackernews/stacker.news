import { USER_ID } from '@/lib/constants'
import { getDeleteAt, getRemindAt } from '@/lib/item'

export async function getMentions ({ text, id }, { me, models }) {
  const mentionPattern = /\B@[\w_]+/gi
  const names = text.match(mentionPattern)?.map(m => m.slice(1))
  if (names?.length > 0) {
    const users = await models.user.findMany({
      where: {
        name: {
          in: names
        },
        id: {
          not: me?.id || USER_ID.anon
        }
      }
    })
    return users.map(user => ({ userId: user.id }))
  }
  return []
}

export async function performBotBehavior ({ text, id }, { me, models, tx }) {
  if (text) {
    const userId = me?.id || USER_ID.anon
    const deleteAt = getDeleteAt(text)
    if (deleteAt) {
      models.$queryRaw`
        DELETE FROM pgboss.job
        WHERE name = 'reminder'
        AND data->>'itemId' = ${id}::TEXT
        AND data->>'userId' = ${userId}::TEXT
        AND state <> 'completed'`
      await tx.$queryRaw`
        INSERT INTO pgboss.job (name, data, startafter, expirein)
        VALUES (
          'deleteItem',
          jsonb_build_object('id', ${id}),
          ${deleteAt},
          ${deleteAt} - now() + interval '1 minute')`
    }

    const remindAt = getRemindAt(text)
    if (remindAt) {
      await tx.$queryRaw`
      DELETE FROM pgboss.job
      WHERE name = 'reminder'
      AND data->>'itemId' = ${id}::TEXT
      AND data->>'userId' = ${userId}::TEXT
      AND state <> 'completed'`
      await tx.reminder.deleteMany({
        where: {
          itemId: Number(id),
          userId: Number(userId),
          remindAt: {
            gt: new Date()
          }
        }
      })
      await tx.$queryRaw`
        INSERT INTO pgboss.job (name, data, startafter, expirein)
        VALUES (
          'remindItem',
          jsonb_build_object('id', ${id}),
          ${remindAt},
          ${remindAt} - now() + interval '1 minute')`
      await tx.reminder.create({
        data: {
          userId,
          itemId: id,
          remindAt
        }
      })
    }
  }
}
