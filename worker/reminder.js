import { notifyReminder } from '@/lib/webPush'

export async function remindUser ({ data: { itemId, userId }, models }) {
  try {
    const item = await models.item.findUnique({ where: { id: itemId } })
    await notifyReminder({ userId, item })
  } catch (err) {
    console.error('failed to send reminder:', err)
  }
}
