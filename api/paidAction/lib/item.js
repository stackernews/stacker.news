import { USER_ID } from '@/lib/constants'
import { deleteReminders, getDeleteAt, getRemindAt } from '@/lib/item'
import { parseInternalLinks } from '@/lib/url'

export async function getMentions ({ text }, { me, tx }) {
  const mentionPattern = /\B@[\w_]+/gi
  const names = text.match(mentionPattern)?.map(m => m.slice(1))
  if (names?.length > 0) {
    const users = await tx.user.findMany({
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

export const getItemMentions = async ({ text }, { me, tx }) => {
  const linkPattern = new RegExp(`${process.env.NEXT_PUBLIC_URL}/items/\\d+[a-zA-Z0-9/?=]*`, 'gi')
  const refs = text.match(linkPattern)?.map(m => {
    try {
      const { itemId, commentId } = parseInternalLinks(m)
      return Number(commentId || itemId)
    } catch (err) {
      return null
    }
  }).filter(r => !!r)

  if (refs?.length > 0) {
    const referee = await tx.item.findMany({
      where: {
        id: { in: refs },
        userId: { not: me?.id || USER_ID.anon }
      }
    })
    return referee.map(r => ({ refereeId: r.id }))
  }

  return []
}

export async function performBotBehavior ({ text, id }, { me, tx }) {
  // delete any existing deleteItem or reminder jobs for this item
  const userId = me?.id || USER_ID.anon
  id = Number(id)
  await tx.$queryRaw`
    DELETE FROM pgboss.job
    WHERE name = 'deleteItem'
    AND data->>'id' = ${id}::TEXT
    AND state <> 'completed'`
  await deleteReminders({ id, userId, models: tx })

  if (text) {
    const deleteAt = getDeleteAt(text)
    if (deleteAt) {
      await tx.$queryRaw`
        INSERT INTO pgboss.job (name, data, startafter, expirein)
        VALUES (
          'deleteItem',
          jsonb_build_object('id', ${id}::INTEGER),
          ${deleteAt}::TIMESTAMP WITH TIME ZONE,
          ${deleteAt}::TIMESTAMP WITH TIME ZONE - now() + interval '1 minute')`
    }

    const remindAt = getRemindAt(text)
    if (remindAt) {
      await tx.$queryRaw`
        INSERT INTO pgboss.job (name, data, startafter, expirein)
        VALUES (
          'reminder',
          jsonb_build_object('itemId', ${id}::INTEGER, 'userId', ${userId}::INTEGER),
          ${remindAt}::TIMESTAMP WITH TIME ZONE,
          ${remindAt}::TIMESTAMP WITH TIME ZONE - now() + interval '1 minute')`
      await tx.reminder.create({
        data: {
          userId,
          itemId: Number(id),
          remindAt
        }
      })
    }
  }
}
