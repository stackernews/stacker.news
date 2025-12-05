import { USER_ID } from '@/lib/constants'
import { deleteReminders, getDeleteAt, getRemindAt } from '@/lib/item'
import { parseInternalLinks } from '@/lib/url'

export async function getSub (models, { subName, parentId }) {
  if (!subName && !parentId) {
    return null
  }

  if (parentId) {
    const [sub] = await models.$queryRaw`
      SELECT "Sub".*
      FROM "Item" i
      LEFT JOIN "Item" r ON r.id = i."rootId"
      JOIN "Sub" ON "Sub".name = COALESCE(r."subName", i."subName")
      WHERE i.id = ${Number(parentId)}`

    return sub
  }

  return await models.sub.findUnique({ where: { name: subName } })
}

// ltree is unsupported in Prisma, so we have to query it manually (FUCK!)
export async function getItemResult (tx, { id }) {
  return (await tx.$queryRaw`
    SELECT *, ltree2text(path) AS path, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM "Item" WHERE id = ${id}::INTEGER`
  )[0]
}

export async function getMentions (tx, { text, userId }) {
  const mentionPattern = /\B@[\w_]+/gi
  const names = text.match(mentionPattern)?.map(m => m.slice(1))
  if (names?.length > 0) {
    const users = await tx.user.findMany({
      where: {
        name: {
          in: names
        },
        id: {
          not: userId || USER_ID.anon
        }
      }
    })
    return users.map(user => ({ userId: user.id }))
  }
  return []
}

export const getItemMentions = async (tx, { text, userId }) => {
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
        userId: { not: userId || USER_ID.anon }
      }
    })
    return referee.map(r => ({ refereeId: r.id }))
  }

  return []
}

export async function performBotBehavior (tx, { text, id, userId = USER_ID.anon }) {
  // delete any existing deleteItem or reminder jobs for this item
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
  }
}
