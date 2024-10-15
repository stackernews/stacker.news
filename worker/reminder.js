import { notifyReminder } from '@/lib/webPush'
export async function remindUser ({ data: { itemId, userId }, models }) {
  let item
  try {
    item = await models.item.findUnique({ where: { id: itemId } })
  } catch (err) {
    console.error('failed to lookup item by id', err)
  }
  try {
    if (item) {
      await notifyReminder({ userId, item, itemId })
    } else {
      await notifyReminder({ userId, itemId })
    }
  } catch (err) {
    console.error('failed to send push notification for reminder', err)
  }
}
