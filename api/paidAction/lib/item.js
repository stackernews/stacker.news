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

export async function performBotBehavior ({ text, id }, { me, tx, lnd }) {
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
    // compute deleteAt with block-awareness
    let deleteAt
    try {
      const { getHeight } = await import('ln-service')
      const height = lnd ? (await getHeight({ lnd }))?.current_block_height : undefined
      deleteAt = getDeleteAt(text, { currentBlockHeight: height })
    } catch (e) {
      deleteAt = getDeleteAt(text)
    }
    if (deleteAt) {
      await tx.$queryRaw`
        INSERT INTO pgboss.job (name, data, startafter, keepuntil)
        VALUES (
          'deleteItem',
          jsonb_build_object('id', ${id}::INTEGER),
          ${deleteAt}::TIMESTAMP WITH TIME ZONE,
          ${deleteAt}::TIMESTAMP WITH TIME ZONE + interval '1 minute')`
    }

    // compute remindAt with block-awareness. If absolute block height was specified,
    // we need the current chain height. We try to read it via lnd if available.
    let remindAt
    try {
      // lazy import to avoid bundling lnd client on client side
      const { getHeight } = await import('ln-service')
      const height = lnd ? (await getHeight({ lnd }))?.current_block_height : undefined
      remindAt = getRemindAt(text, { currentBlockHeight: height })
    } catch (e) {
      // fallback to time-based parse only
      remindAt = getRemindAt(text)
    }
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
  }
}
