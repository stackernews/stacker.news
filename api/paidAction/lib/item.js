import { getDeleteAt, getRemindAt } from '@/lib/item'

export async function getMentions ({ text, id }, { me, models }) {
  const mentions = []
  const mentionPattern = /\B@[\w_]+/gi
  const names = text.match(mentionPattern)?.map(m => m.slice(1))
  if (names?.length > 0) {
    const users = await models.user.findMany({ where: { name: { in: names } } })
    mentions.push(...users.map(({ id }) => ({ userId: id }))
      .filter(({ userId }) => userId !== me.id))
  }
  return mentions
}

export async function performBotBehavior ({ text, id }, { me, models, tx }) {
  if (text) {
    const deleteAt = getDeleteAt(text)
    if (deleteAt) {
      models.$queryRawUnsafe(`
        DELETE FROM pgboss.job
        WHERE name = 'reminder'
        AND data->>'itemId' = '${id}'
        AND data->>'userId' = '${me.id}'
        AND state <> 'completed'`)
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
      await tx.$queryRawUnsafe(`
      DELETE FROM pgboss.job
      WHERE name = 'reminder'
      AND data->>'itemId' = '${id}'
      AND data->>'userId' = '${me.id}'
      AND state <> 'completed'`)
      await tx.reminder.deleteMany({
        where: {
          itemId: Number(id),
          userId: Number(me.id),
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
          userId: me.id,
          itemId: id,
          remindAt
        }
      })
    }
  }
}
