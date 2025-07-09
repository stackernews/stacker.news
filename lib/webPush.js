import webPush from 'web-push'
import removeMd from 'remove-markdown'
import { COMMENT_DEPTH_LIMIT, FOUND_BLURBS, LOST_BLURBS } from './constants'
import { msatsToSats, numWithUnits } from './format'
import models from '@/api/models'
import { isMuted } from '@/lib/user'
import { Prisma } from '@prisma/client'

const webPushEnabled = process.env.NODE_ENV === 'production' ||
  (process.env.VAPID_MAILTO && process.env.NEXT_PUBLIC_VAPID_PUBKEY && process.env.VAPID_PRIVKEY)

function log (...args) {
  console.log('[webPush]', ...args)
}

function createPayload (notification) {
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

function createUserFilter (tag) {
  // filter users by notification settings
  const tagMap = {
    THREAD: 'noteAllDescendants',
    MENTION: 'noteMentions',
    ITEM_MENTION: 'noteItemMentions',
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

async function createItemUrl ({ id }) {
  const [rootItem] = await models.$queryRawUnsafe(
    'SELECT subpath(path, -LEAST(nlevel(path), $1::INTEGER), 1)::text AS id FROM "Item" WHERE id = $2::INTEGER',
    COMMENT_DEPTH_LIMIT + 1, Number(id)
  )
  return `/items/${rootItem.id}` + (rootItem.id !== id ? `?commentId=${id}` : '')
}

async function sendNotification (subscription, payload) {
  if (!webPushEnabled) {
    log('webPush not configured, skipping notification')
    return
  }

  const { id, endpoint, p256dh, auth } = subscription
  return await webPush.sendNotification(
    {
      endpoint,
      keys: { p256dh, auth }
    },
    payload,
    {
      vapidDetails: {
        subject: process.env.VAPID_MAILTO,
        publicKey: process.env.NEXT_PUBLIC_VAPID_PUBKEY,
        privateKey: process.env.VAPID_PRIVKEY
      }
    })
    .catch(async (err) => {
      switch (err.statusCode) {
        case 400:
          log('invalid request:', err)
          break
        case 401:
        case 403:
          log('auth error:', err)
          break
        case 404:
        case 410: {
          log('subscription expired or no longer valid:', err)
          const deletedSubscripton = await models.pushSubscription.delete({ where: { id } })
          log(`deleted subscription ${id} of user ${deletedSubscripton.userId} due to push error`)
          break
        }
        case 413:
          log('payload too large:', err)
          break
        case 429:
          log('too many requests:', err)
          break
        default:
          log('error:', err)
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

    // XXX we only want to use the tag to filter follow-up replies by user settings
    // but still merge them with normal replies
    if (notification.tag === 'THREAD') notification.tag = 'REPLY'

    const payload = createPayload(notification)
    const subscriptions = await models.pushSubscription.findMany({
      where: { userId, ...userFilter }
    })
    await Promise.allSettled(
      subscriptions.map(subscription => sendNotification(subscription, payload))
    )
  } catch (err) {
    log('error sending user notification:', err)
  }
}

export async function sendPushSubscriptionReply (subscription) {
  try {
    const payload = createPayload({ title: 'Stacker News notifications are now active' })
    await sendNotification(subscription, payload)
  } catch (err) {
    log('error sending subscription reply:', err)
  }
}

export async function notifyUserSubscribers ({ models, item }) {
  try {
    const isPost = !!item.title

    const userSubsExcludingMutes = await models.$queryRaw`
      SELECT "UserSubscription"."followerId", "UserSubscription"."followeeId", users.name as "followeeName"
      FROM "UserSubscription"
      INNER JOIN users ON users.id = "UserSubscription"."followeeId"
      WHERE "followeeId" = ${Number(item.userId)}::INTEGER
        AND ${isPost ? Prisma.sql`"postsSubscribedAt"` : Prisma.sql`"commentsSubscribedAt"`} IS NOT NULL
        -- ignore muted users
        AND NOT EXISTS (
          SELECT 1
          FROM "Mute"
          WHERE "Mute"."muterId" = "UserSubscription"."followerId"
          AND "Mute"."mutedId" = ${Number(item.userId)}::INTEGER)
        -- ignore subscription if user was already notified of item as a reply
        AND NOT EXISTS (
          SELECT 1 FROM "Reply"
          INNER JOIN users follower ON follower.id = "UserSubscription"."followerId"
          WHERE "Reply"."itemId" = ${Number(item.id)}::INTEGER
          AND "Reply"."ancestorUserId" = follower.id
          AND follower."noteAllDescendants"
        )
        -- ignore subscription if user has posted to a territory the recipient is subscribed to
        ${isPost
          ? Prisma.sql`AND NOT EXISTS (
            SELECT 1
            FROM "SubSubscription"
            WHERE "SubSubscription"."userId" = "UserSubscription"."followerId"
            AND "SubSubscription"."subName" = ${item.subName}
          )`
          : Prisma.empty}`
    const subType = isPost ? 'POST' : 'COMMENT'
    const tag = `FOLLOW-${item.userId}-${subType}`
    await Promise.allSettled(userSubsExcludingMutes.map(({ followerId, followeeName }) => sendUserNotification(followerId, {
      title: `@${followeeName} ${isPost ? 'created a post' : 'replied to a post'}`,
      body: isPost ? item.title : item.text,
      item,
      data: { followeeName, subType },
      tag
    })))
  } catch (err) {
    log('error sending user notification:', err)
  }
}

export async function notifyTerritorySubscribers ({ models, item }) {
  try {
    const isPost = !!item.title
    const { subName } = item

    // only notify on posts in subs
    if (!isPost || !subName) return

    const territorySubsExcludingMuted = await models.$queryRawUnsafe(`
    SELECT "userId" FROM "SubSubscription"
    WHERE "subName" = $1
    AND NOT EXISTS (SELECT 1 FROM "Mute" m WHERE m."muterId" = "SubSubscription"."userId" AND m."mutedId" = $2)
    `, subName, Number(item.userId))

    const author = await models.user.findUnique({ where: { id: item.userId } })

    const tag = `TERRITORY_POST-${subName}`
    await Promise.allSettled(
      territorySubsExcludingMuted
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
    log('error sending territory notification:', err)
  }
}

export async function notifyThreadSubscribers ({ models, item }) {
  try {
    const author = await models.user.findUnique({ where: { id: item.userId } })

    const subscribers = await models.$queryRaw`
      SELECT DISTINCT "ThreadSubscription"."userId" FROM "ThreadSubscription"
      JOIN users ON users.id = "ThreadSubscription"."userId"
      JOIN "Reply" r ON "ThreadSubscription"."itemId" = r."ancestorId"
      WHERE r."itemId" = ${item.id}
      -- don't send notifications for own items
      AND r."userId" <> "ThreadSubscription"."userId"
      -- send notifications for all levels?
      AND CASE WHEN users."noteAllDescendants" THEN TRUE ELSE r.level = 1 END
      -- muted?
      AND NOT EXISTS (SELECT 1 FROM "Mute" m WHERE m."muterId" = users.id AND m."mutedId" = r."userId")
      -- already received notification as reply to self?
      AND NOT EXISTS (
        SELECT 1 FROM "Item" i
        JOIN "Item" p ON p.path @> i.path
        WHERE i.id = ${item.parentId} AND p."userId" = "ThreadSubscription"."userId" AND users."noteAllDescendants"
      )`

    await Promise.allSettled(subscribers.map(({ userId }) =>
      sendUserNotification(userId, {
        // we reuse the same payload as for user subscriptions because they use the same title+body we want to use here
        // so we should also merge them together (= same tag+data) to avoid confusion
        title: `@${author.name} replied to a post`,
        body: item.text,
        item,
        data: { followeeName: author.name, subType: 'COMMENT' },
        tag: `FOLLOW-${author.id}-COMMENT`
      })
    ))
  } catch (err) {
    log('error sending thread notification:', err)
  }
}

export async function notifyItemParents ({ models, item }) {
  try {
    const user = await models.user.findUnique({ where: { id: item.userId } })
    const parents = await models.$queryRaw`
      SELECT DISTINCT p."userId", i."userId" = p."userId" as "isDirect"
      FROM "Item" i
      JOIN "Item" p ON p.path @> i.path
      WHERE i.id = ${Number(item.parentId)} and p."userId" <> ${Number(user.id)}
      AND NOT EXISTS (
        SELECT 1 FROM "Mute" m
        WHERE m."muterId" = p."userId" AND m."mutedId" = ${Number(user.id)}
      )
      AND EXISTS (
        -- check that there is at least one parent subscribed to this thread
        SELECT 1 FROM "ThreadSubscription" ts WHERE p.id = ts."itemId" AND p."userId" = ts."userId"
      )`
    await Promise.allSettled(
      parents.map(({ userId, isDirect }) => {
        return sendUserNotification(userId, {
          title: `@${user.name} replied to you`,
          body: item.text,
          item,
          tag: isDirect ? 'REPLY' : 'THREAD'
        })
      })
    )
  } catch (err) {
    log('error sending item parents notification:', err)
  }
}

export async function notifyZapped ({ models, item }) {
  try {
    const forwards = await models.itemForward.findMany({ where: { itemId: item.id } })
    const userPromises = forwards.map(fwd => models.user.findUnique({ where: { id: fwd.userId } }))
    const userResults = await Promise.allSettled(userPromises)
    const mappedForwards = forwards.map((fwd, index) => ({ ...fwd, user: userResults[index].value ?? null }))
    let forwardedSats = 0
    let forwardedUsers = ''
    if (mappedForwards.length) {
      forwardedSats = Math.floor(msatsToSats(item.msats) * mappedForwards.map(fwd => fwd.pct).reduce((sum, cur) => sum + cur) / 100)
      forwardedUsers = mappedForwards.map(fwd => `@${fwd.user.name}`).join(', ')
    }
    let title
    if (item.title) {
      if (forwards.length > 0) {
        title = `your post forwarded ${numWithUnits(forwardedSats)} to ${forwardedUsers}`
      } else {
        title = `your post stacked ${numWithUnits(msatsToSats(item.msats))}`
      }
    } else {
      if (forwards.length > 0) {
        // I don't think this case is possible
        title = `your reply forwarded ${numWithUnits(forwardedSats)} to ${forwardedUsers}`
      } else {
        title = `your reply stacked ${numWithUnits(msatsToSats(item.msats))}`
      }
    }

    await sendUserNotification(item.userId, {
      title,
      body: item.title ? item.title : item.text,
      item,
      tag: `TIP-${item.id}`
    })

    // send push notifications to forwarded recipients
    if (mappedForwards.length) {
      await Promise.allSettled(mappedForwards.map(forward => sendUserNotification(forward.user.id, {
        title: `you were forwarded ${numWithUnits(Math.round(msatsToSats(item.msats) * forward.pct / 100))}`,
        body: item.title ?? item.text,
        item,
        tag: `FORWARDEDTIP-${item.id}`
      })))
    }
  } catch (err) {
    log('error sending zapped notification:', err)
  }
}

export async function notifyMention ({ models, userId, item }) {
  try {
    const muted = await isMuted({ models, muterId: userId, mutedId: item.userId })
    if (muted) return

    await sendUserNotification(userId, {
      title: `@${item.user.name} mentioned you`,
      body: item.text,
      item,
      tag: 'MENTION'
    })
  } catch (err) {
    log('error sending mention notification:', err)
  }
}

export async function notifyItemMention ({ models, referrerItem, refereeItem }) {
  try {
    const muted = await isMuted({ models, muterId: refereeItem.userId, mutedId: referrerItem.userId })
    if (!muted) {
      const referrer = await models.user.findUnique({ where: { id: referrerItem.userId } })

      // replace full links to #<id> syntax as rendered on site
      const body = referrerItem.text.replace(new RegExp(`${process.env.NEXT_PUBLIC_URL}/items/(\\d+)`, 'gi'), '#$1')

      await sendUserNotification(refereeItem.userId, {
        title: `@${referrer.name} mentioned one of your items`,
        body,
        item: referrerItem,
        tag: 'ITEM_MENTION'
      })
    }
  } catch (err) {
    log('error sending item mention notification:', err)
  }
}

export async function notifyReferral (userId) {
  try {
    await sendUserNotification(userId, { title: 'someone joined via one of your referral links', tag: 'REFERRAL' })
  } catch (err) {
    log('error sending referral notification:', err)
  }
}

export async function notifyInvite (userId) {
  try {
    await sendUserNotification(userId, { title: 'your invite has been redeemed', tag: 'INVITE' })
  } catch (err) {
    log('error sending invite notification:', err)
  }
}

export async function notifyTerritoryTransfer ({ models, sub, to }) {
  try {
    await sendUserNotification(to.id, {
      title: `~${sub.name} was transferred to you`,
      tag: `TERRITORY_TRANSFER-${sub.name}`
    })
  } catch (err) {
    log('error sending territory transfer notification:', err)
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
    log('error sending earn notification:', err)
  }
}

export async function notifyDeposit (userId, invoice) {
  try {
    await sendUserNotification(userId, {
      title: `${numWithUnits(msatsToSats(invoice.msatsReceived), { abbreviate: false, unitSingular: 'sat was', unitPlural: 'sats were' })} deposited in your account`,
      body: invoice.comment || undefined,
      tag: 'DEPOSIT',
      data: { sats: msatsToSats(invoice.msatsReceived) }
    })
  } catch (err) {
    log('error sending deposit notification:', err)
  }
}

export async function notifyWithdrawal (wdrwl) {
  try {
    await sendUserNotification(wdrwl.userId, {
      title: `${numWithUnits(msatsToSats(wdrwl.msatsPaid), { abbreviate: false, unitSingular: 'sat was', unitPlural: 'sats were' })} withdrawn from your account`,
      tag: 'WITHDRAWAL',
      data: { sats: msatsToSats(wdrwl.msatsPaid) }
    })
  } catch (err) {
    log('error sending withdrawal notification:', err)
  }
}

export async function notifyNewStreak (userId, streak) {
  const index = streak.id % FOUND_BLURBS[streak.type].length
  const blurb = FOUND_BLURBS[streak.type][index]

  try {
    await sendUserNotification(userId, {
      title: `you found a ${streak.type.toLowerCase().replace('_', ' ')}`,
      body: blurb,
      tag: `STREAK-FOUND-${streak.type}`
    })
  } catch (err) {
    log('error sending streak found notification:', err)
  }
}

export async function notifyStreakLost (userId, streak) {
  const index = streak.id % LOST_BLURBS[streak.type].length
  const blurb = LOST_BLURBS[streak.type][index]

  try {
    await sendUserNotification(userId, {
      title: `you lost your ${streak.type.toLowerCase().replace('_', ' ')}`,
      body: blurb,
      tag: `STREAK-LOST-${streak.type}`
    })
  } catch (err) {
    log('error sending streak lost notification:', err)
  }
}

export async function notifyReminder ({ userId, item }) {
  await sendUserNotification(userId, {
    title: 'you requested this reminder',
    body: item.title ?? item.text,
    tag: `REMIND-ITEM-${item.id}`,
    item
  })
}
