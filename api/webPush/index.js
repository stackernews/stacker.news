import webPush from 'web-push'
import models from '../models'
import { COMMENT_DEPTH_LIMIT } from '../../lib/constants'
import removeMd from 'remove-markdown'

const webPushEnabled = process.env.NODE_ENV === 'production' ||
  (process.env.VAPID_MAILTO && process.env.NEXT_PUBLIC_VAPID_PUBKEY && process.env.VAPID_PRIVKEY)

if (webPushEnabled) {
  webPush.setVapidDetails(
    process.env.VAPID_MAILTO,
    process.env.NEXT_PUBLIC_VAPID_PUBKEY,
    process.env.VAPID_PRIVKEY
  )
} else {
  console.warn('VAPID_* env vars not set, skipping webPush setup')
}

const createPayload = (notification) => {
  // https://web.dev/push-notifications-display-a-notification/#visual-options
  let { title, body, ...options } = notification
  if (body) body = removeMd(body)
  return JSON.stringify({
    title,
    options: {
      body,
      timestamp: Date.now(),
      icon: '/icons/icon_x96.png',
      ...options
    }
  })
}

const createUserFilter = (tag) => {
  // filter users by notification settings
  const tagMap = {
    REPLY: 'noteAllDescendants',
    MENTION: 'noteMentions',
    TIP: 'noteItemSats'
  }
  const key = tagMap[tag.split('-')[0]]
  return key ? { user: { [key]: true } } : undefined
}

const createItemUrl = async ({ id }) => {
  const [rootItem] = await models.$queryRawUnsafe(
    'SELECT subpath(path, -LEAST(nlevel(path), $1::INTEGER), 1)::text AS id FROM "Item" WHERE id = $2::INTEGER',
    COMMENT_DEPTH_LIMIT + 1, Number(id)
  )
  return `/items/${rootItem.id}` + (rootItem.id !== id ? `?commentId=${id}` : '')
}

const sendNotification = (subscription, payload) => {
  if (!webPushEnabled) {
    console.warn('webPush not configured. skipping notification')
    return
  }
  const { id, endpoint, p256dh, auth } = subscription
  return webPush.sendNotification({ endpoint, keys: { p256dh, auth } }, payload)
    .catch(async (err) => {
      if (err.statusCode === 400) {
        console.log('[webPush] invalid request: ', err)
      } else if ([401, 403].includes(err.statusCode)) {
        console.log('[webPush] auth error: ', err)
      } else if (err.statusCode === 404 || err.statusCode === 410) {
        console.log('[webPush] subscription has expired or is no longer valid: ', err)
        const deletedSubscripton = await models.pushSubscription.delete({ where: { id } })
        console.log(`[webPush] deleted subscription ${id} of user ${deletedSubscripton.userId} due to push error`)
      } else if (err.statusCode === 413) {
        console.log('[webPush] payload too large: ', err)
      } else if (err.statusCode === 429) {
        console.log('[webPush] too many requests: ', err)
      } else {
        console.log('[webPush] error: ', err)
      }
    })
}

export async function sendUserNotification (userId, notification) {
  try {
    notification.data ??= {}
    if (notification.item) {
      notification.data.url ??= await createItemUrl(notification.item)
      delete notification.item
    }
    const userFilter = createUserFilter(notification.tag)
    const payload = createPayload(notification)
    const subscriptions = await models.pushSubscription.findMany({
      where: { userId, ...userFilter }
    })
    await Promise.allSettled(
      subscriptions.map(subscription => sendNotification(subscription, payload))
    )
  } catch (err) {
    console.log('[webPush] error sending user notification: ', err)
  }
}

export async function replyToSubscription (subscriptionId, notification) {
  try {
    const payload = createPayload(notification)
    const subscription = await models.pushSubscription.findUnique({ where: { id: subscriptionId } })
    await sendNotification(subscription, payload)
  } catch (err) {
    console.log('[webPush] error sending subscription reply: ', err)
  }
}
