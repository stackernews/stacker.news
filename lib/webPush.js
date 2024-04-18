import webPush from 'web-push'
import removeMd from 'remove-markdown'
import { ANON_USER_ID, COMMENT_DEPTH_LIMIT, FOUND_BLURBS, LOST_BLURBS } from './constants'
import { msatsToSats, numWithUnits } from './format'
import models from '@/api/models'

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
    TIP: 'noteItemSats',
    FORWARDEDTIP: 'noteForwardedSats',
    REFERRAL: 'noteInvites',
    INVITE: 'noteInvites',
    EARN: 'noteEarning',
    DEPOSIT: 'noteDeposits',
    WITHDRAWAL: 'noteWithdrawals',
    STREAK: 'noteCowboyHat'
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

async function sendUserNotification (userId, notification) {
  try {
    if (!userId) {
      throw new Error('user id is required')
    }
    notification.data ??= {}
    if (notification.item) {
      notification.data.url ??= await createItemUrl(notification.item)
      notification.data.itemId ??= notification.item.id
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

export const notifyUserSubscribers = async ({ models, item }) => {
  try {
    const isPost = !!item.title
    const userSubs = await models.userSubscription.findMany({
      where: {
        followeeId: Number(item.userId),
        [isPost ? 'postsSubscribedAt' : 'commentsSubscribedAt']: { not: null }
      },
      include: {
        followee: true
      }
    })
    const subType = isPost ? 'POST' : 'COMMENT'
    const tag = `FOLLOW-${item.userId}-${subType}`
    await Promise.allSettled(userSubs.map(({ followerId, followee }) => sendUserNotification(followerId, {
      title: `@${followee.name} ${isPost ? 'created a post' : 'replied to a post'}`,
      body: isPost ? item.title : item.text,
      item,
      data: { followeeName: followee.name, subType },
      tag
    })))
  } catch (err) {
    console.error(err)
  }
}

export const notifyTerritorySubscribers = async ({ models, item }) => {
  try {
    const isPost = !!item.title
    const { subName } = item

    // only notify on posts in subs
    if (!isPost || !subName) return

    const territorySubs = await models.subSubscription.findMany({
      where: {
        subName
      }
    })

    const author = await models.user.findUnique({ where: { id: item.userId } })

    const tag = `TERRITORY_POST-${subName}`
    await Promise.allSettled(
      territorySubs
        // don't send push notification to author itself
        .filter(({ userId }) => userId !== author.id)
        .map(({ userId }) =>
          sendUserNotification(userId, {
            title: `@${author.name} created a post in ~${subName}`,
            body: item.title,
            item,
            data: { subName },
            tag
          })))
  } catch (err) {
    console.error(err)
  }
}

export const notifyItemParents = async ({ models, item, me }) => {
  try {
    const user = await models.user.findUnique({ where: { id: me?.id || ANON_USER_ID } })
    const parents = await models.$queryRawUnsafe(
      'SELECT DISTINCT p."userId" FROM "Item" i JOIN "Item" p ON p.path @> i.path WHERE i.id = $1 and p."userId" <> $2 ' +
      'AND NOT EXISTS (SELECT 1 FROM "Mute" m WHERE m."muterId" = p."userId" AND m."mutedId" = $2)',
      Number(item.parentId), Number(user.id))
    Promise.allSettled(
      parents.map(({ userId }) => sendUserNotification(userId, {
        title: `@${user.name} replied to you`,
        body: item.text,
        item,
        tag: 'REPLY'
      }))
    )
  } catch (err) {
    console.error(err)
  }
}

export const notifyZapped = async ({ models, id }) => {
  try {
    const updatedItem = await models.item.findUnique({ where: { id: Number(id) } })
    const forwards = await models.itemForward.findMany({ where: { itemId: Number(id) } })
    const userPromises = forwards.map(fwd => models.user.findUnique({ where: { id: fwd.userId } }))
    const userResults = await Promise.allSettled(userPromises)
    const mappedForwards = forwards.map((fwd, index) => ({ ...fwd, user: userResults[index].value ?? null }))
    let forwardedSats = 0
    let forwardedUsers = ''
    if (mappedForwards.length) {
      forwardedSats = Math.floor(msatsToSats(updatedItem.msats) * mappedForwards.map(fwd => fwd.pct).reduce((sum, cur) => sum + cur) / 100)
      forwardedUsers = mappedForwards.map(fwd => `@${fwd.user.name}`).join(', ')
    }
    let notificationTitle
    if (updatedItem.title) {
      if (forwards.length > 0) {
        notificationTitle = `your post forwarded ${numWithUnits(forwardedSats)} to ${forwardedUsers}`
      } else {
        notificationTitle = `your post stacked ${numWithUnits(msatsToSats(updatedItem.msats))}`
      }
    } else {
      if (forwards.length > 0) {
        // I don't think this case is possible
        notificationTitle = `your reply forwarded ${numWithUnits(forwardedSats)} to ${forwardedUsers}`
      } else {
        notificationTitle = `your reply stacked ${numWithUnits(msatsToSats(updatedItem.msats))}`
      }
    }
    await sendUserNotification(updatedItem.userId, {
      title: notificationTitle,
      body: updatedItem.title ? updatedItem.title : updatedItem.text,
      item: updatedItem,
      tag: `TIP-${updatedItem.id}`
    })

    // send push notifications to forwarded recipients
    if (mappedForwards.length) {
      await Promise.allSettled(mappedForwards.map(forward => sendUserNotification(forward.user.id, {
        title: `you were forwarded ${numWithUnits(Math.round(msatsToSats(updatedItem.msats) * forward.pct / 100))}`,
        body: updatedItem.title ?? updatedItem.text,
        item: updatedItem,
        tag: `FORWARDEDTIP-${updatedItem.id}`
      })))
    }
  } catch (err) {
    console.error(err)
  }
}

export const notifyMention = async (userId, item) => {
  try {
    await sendUserNotification(userId, {
      title: 'you were mentioned',
      body: item.text,
      item,
      tag: 'MENTION'
    })
  } catch (err) {
    console.error(err)
  }
}

export const notifyReferral = async (userId) => {
  try {
    await sendUserNotification(userId, { title: 'someone joined via one of your referral links', tag: 'REFERRAL' })
  } catch (err) {
    console.error(err)
  }
}

export const notifyInvite = async (userId) => {
  try {
    await sendUserNotification(userId, { title: 'your invite has been redeemed', tag: 'INVITE' })
  } catch (err) {
    console.error(err)
  }
}

export const notifyTerritoryTransfer = async ({ models, sub, to }) => {
  try {
    await sendUserNotification(to.id, {
      title: `~${sub.name} was transferred to you`,
      tag: `TERRITORY_TRANSFER-${sub.name}`
    })
  } catch (err) {
    console.error(err)
  }
}

export async function notifyEarner (userId, earnings) {
  const fmt = msats => numWithUnits(msatsToSats(msats, { abbreviate: false }))

  const title = `you stacked ${fmt(earnings.msats)} in rewards`
  const tag = 'EARN'
  let body = ''
  if (earnings.POST) body += `#${earnings.POST.bestRank} among posts with ${fmt(earnings.POST.msats)} in total\n`
  if (earnings.COMMENT) body += `#${earnings.COMMENT.bestRank} among comments with ${fmt(earnings.COMMENT.msats)} in total\n`
  if (earnings.TIP_POST) body += `#${earnings.TIP_POST.bestRank} in post zapping with ${fmt(earnings.TIP_POST.msats)} in total\n`
  if (earnings.TIP_COMMENT) body += `#${earnings.TIP_COMMENT.bestRank} in comment zapping with ${fmt(earnings.TIP_COMMENT.msats)} in total`

  try {
    await sendUserNotification(userId, { title, tag, body })
  } catch (err) {
    console.error(err)
  }
}

export async function notifyDeposit (userId, invoice) {
  try {
    await sendUserNotification(userId, {
      title: `${numWithUnits(msatsToSats(invoice.received_mtokens), { abbreviate: false, unitSingular: 'sat was', unitPlural: 'sats were' })} deposited in your account`,
      body: invoice.comment || undefined,
      tag: 'DEPOSIT',
      data: { sats: msatsToSats(invoice.received_mtokens) }
    })
  } catch (err) {
    console.error(err)
  }
}

export async function notifyWithdrawal (userId, wdrwl) {
  try {
    await sendUserNotification(userId, {
      title: `${numWithUnits(msatsToSats(wdrwl.payment.mtokens), { abbreviate: false, unitSingular: 'sat was', unitPlural: 'sats were' })} withdrawn from your account`,
      tag: 'WITHDRAWAL',
      data: { sats: msatsToSats(wdrwl.payment.mtokens) }
    })
  } catch (err) {
    console.error(err)
  }
}

export async function notifyNewStreak (userId, streak) {
  const index = streak.id % FOUND_BLURBS.length
  const blurb = FOUND_BLURBS[index]

  try {
    await sendUserNotification(userId, {
      title: 'you found a cowboy hat',
      body: blurb,
      tag: 'STREAK-FOUND'
    })
  } catch (err) {
    console.error(err)
  }
}

export async function notifyStreakLost (userId, streak) {
  const index = streak.id % LOST_BLURBS.length
  const blurb = LOST_BLURBS[index]

  try {
    await sendUserNotification(userId, {
      title: 'you lost your cowboy hat',
      body: blurb,
      tag: 'STREAK-LOST'
    })
  } catch (err) {
    console.error(err)
  }
}
