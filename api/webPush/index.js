import webPush from 'web-push'
import models from '../models'

webPush.setVapidDetails(
  process.env.VAPID_MAILTO,
  process.env.NEXT_PUBLIC_VAPID_PUBKEY,
  process.env.VAPID_PRIVKEY
)

const createPayload = (notification) => {
  // https://web.dev/push-notifications-display-a-notification/#visual-options
  const { title, ...options } = notification
  return JSON.stringify({
    title,
    options: {
      timestamp: Date.now(),
      icon: '/android-chrome-96x96.png',
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
  return key ? { user: { where: { [key]: true } } } : undefined
}

const sendNotification = (subscription, payload) => {
  const { id, endpoint, p256dh, auth } = subscription
  return webPush.sendNotification({ endpoint, keys: { p256dh, auth } }, payload)
    .catch((err) => {
      if (err.statusCode === 400) {
        console.log('[webPush] invalid request: ', err)
      } else if (err.statusCode === 403) {
        console.log('[webPush] auth error: ', err)
      } else if (err.statusCode === 404 || err.statusCode === 410) {
        console.log('[webPush] subscription has expired or is no longer valid: ', err)
        return models.pushSubscription.delete({ where: { id } })
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
    const userFilter = createUserFilter(notification.tag)
    const payload = createPayload(notification)
    const subscriptions = await models.pushSubscription.findMany({
      where: { userId },
      include: userFilter
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
