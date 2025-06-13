import { notifyItemMention, notifyItemParents, notifyMention, notifyTerritorySubscribers, notifyUserSubscribers, notifyThreadSubscribers } from '@/lib/webPush'

export async function publishScheduledPost ({ data: { itemId }, models, lnd }) {
  console.log('publishing scheduled post', itemId)

  const item = await models.item.findUnique({
    where: { id: itemId },
    include: {
      user: true,
      mentions: true,
      itemReferrers: { include: { refereeItem: true } }
    }
  })

  if (!item || !item.scheduledAt || item.deletedAt) {
    console.log('item not found, not scheduled, or deleted', itemId)
    return
  }

  const publishTime = new Date()

  // Update the item to be published with new timestamp
  await models.item.update({
    where: { id: itemId },
    data: {
      scheduledAt: null,
      createdAt: publishTime,
      updatedAt: publishTime
    }
  })

  // Refresh any cached views or materialized data that might reference this item
  await models.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY hot_score_view`

  // Queue side effects
  await models.$executeRaw`
    INSERT INTO pgboss.job (name, data, startafter)
    VALUES ('schedulePostSideEffects', jsonb_build_object('itemId', ${itemId}::INTEGER), now())`

  console.log('published scheduled post with new timestamp', itemId, publishTime)
}

export async function schedulePostSideEffects ({ data: { itemId }, models }) {
  const item = await models.item.findFirst({
    where: { id: itemId },
    include: {
      mentions: true,
      itemReferrers: { include: { refereeItem: true } },
      user: true
    }
  })

  if (!item) {
    console.log('item not found for side effects', itemId)
    return
  }

  // Send notifications for scheduled posts that are now published
  if (item.parentId) {
    notifyItemParents({ item, models }).catch(console.error)
    notifyThreadSubscribers({ models, item }).catch(console.error)
  }

  for (const { userId } of item.mentions) {
    notifyMention({ models, item, userId }).catch(console.error)
  }

  for (const { refereeItem } of item.itemReferrers) {
    notifyItemMention({ models, referrerItem: item, refereeItem }).catch(console.error)
  }

  notifyUserSubscribers({ models, item }).catch(console.error)
  notifyTerritorySubscribers({ models, item }).catch(console.error)

  console.log('completed side effects for scheduled post', itemId)
}
