import { USER_ID } from '@/lib/constants'
import { deleteReminders, getDeleteAt, getRemindAt, getScheduleAt } from '@/lib/item'
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
  // delete any existing deleteItem, reminder, or publishScheduledPost jobs for this item
  const userId = me?.id || USER_ID.anon
  id = Number(id)
  await tx.$queryRaw`
    DELETE FROM pgboss.job
    WHERE (name = 'deleteItem' OR name = 'publishScheduledPost')
    AND data->>'id' = ${id}::TEXT
    AND state <> 'completed'`
  await tx.$queryRaw`
    DELETE FROM pgboss.job
    WHERE name = 'publishScheduledPost'
    AND data->>'itemId' = ${id}::TEXT
    AND state <> 'completed'`
  await deleteReminders({ id, userId, models: tx })

  if (text) {
    const deleteAt = getDeleteAt(text)
    if (deleteAt) {
      await tx.$queryRaw`
        INSERT INTO pgboss.job (name, data, startafter, keepuntil)
        VALUES (
          'deleteItem',
          jsonb_build_object('id', ${id}::INTEGER),
          ${deleteAt}::TIMESTAMP WITH TIME ZONE,
          ${deleteAt}::TIMESTAMP WITH TIME ZONE + interval '1 minute')`
    }

    const remindAt = getRemindAt(text)
    if (remindAt) {
      await tx.$queryRaw`
        INSERT INTO pgboss.job (name, data, startafter, keepuntil)
        VALUES (
          'reminder',
          jsonb_build_object('itemId', ${id}::INTEGER, 'userId', ${userId}::INTEGER),
          ${remindAt}::TIMESTAMP WITH TIME ZONE,
          ${remindAt}::TIMESTAMP WITH TIME ZONE + interval '1 minute')`
      await tx.reminder.create({
        data: {
          userId,
          itemId: Number(id),
          remindAt
        }
      })
    }

    const scheduleAt = getScheduleAt(text)
    if (scheduleAt) {
      // For new items, scheduling info is set during creation
      // For updates, we need to update the item
      const existingItem = await tx.item.findUnique({ where: { id: Number(id) } })
      if (existingItem && !existingItem.scheduledAt) {
        await tx.item.update({
          where: { id: Number(id) },
          data: {
            scheduledAt: scheduleAt
          }
        })
      }

      // Schedule the job to publish the post
      await tx.$queryRaw`
        INSERT INTO pgboss.job (name, data, startafter, keepuntil)
        VALUES (
          'publishScheduledPost',
          jsonb_build_object('itemId', ${id}::INTEGER),
          ${scheduleAt}::TIMESTAMP WITH TIME ZONE,
          ${scheduleAt}::TIMESTAMP WITH TIME ZONE + interval '1 minute')`
    }
  }
}
