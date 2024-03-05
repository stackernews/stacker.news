import { sendUserNotification } from '../api/webPush'
import { ANON_USER_ID } from './constants'
import { msatsToSats, numWithUnits } from './format'

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
        title: `you were forwarded ${numWithUnits(msatsToSats(updatedItem.msats) * forward.pct / 100)}`,
        body: updatedItem.title ?? updatedItem.text,
        item: updatedItem,
        tag: `FORWARDEDTIP-${updatedItem.id}`
      })))
    }
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
