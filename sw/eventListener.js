import ServiceWorkerStorage from 'serviceworker-storage'
import { numWithUnits } from '../lib/format'
import { CLEAR_NOTIFICATIONS, clearAppBadge, setAppBadge } from '../lib/badge'
import { ACTION_PORT, DELETE_SUBSCRIPTION, MESSAGE_PORT, STORE_OS, STORE_SUBSCRIPTION, SYNC_SUBSCRIPTION } from '../components/serviceworker'

// we store existing push subscriptions to keep them in sync with server
const storage = new ServiceWorkerStorage('sw:storage', 1)

// for communication between app and service worker
// see https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel
let messageChannelPort
let actionChannelPort

// operating system. the value will be received via a STORE_OS message from app since service workers don't have access to window.navigator
let os = ''
const iOS = () => os === 'iOS'

// current push notification count for badge purposes
let activeCount = 0

const log = (message, level = 'info', context) => {
  messageChannelPort?.postMessage({ level, message, context })
}

export function onPush (sw) {
  return async (event) => {
    const payload = event.data?.json()
    if (!payload) return
    const { tag } = payload.options
    event.waitUntil((async () => {
      // generate random ID for every incoming push for better tracing in logs
      const nid = crypto.randomUUID()
      log(`[sw:push] ${nid} - received notification with tag ${tag}`)

      // due to missing proper tag support in Safari on iOS, we can't rely on the tag built-in filter.
      // we therefore fetch all notifications with the same tag and manually filter them, too.
      // see https://bugs.webkit.org/show_bug.cgi?id=258922
      const notifications = await sw.registration.getNotifications({ tag })
      log(`[sw:push] ${nid} - found ${notifications.length} ${tag} notifications`)
      log(`[sw:push] ${nid} - built-in tag filter: ${JSON.stringify(notifications.map(({ tag }) => tag))}`)

      // we're not sure if the built-in tag filter actually filters by tag on iOS
      // or if it just returns all currently displayed notifications (?)
      const filtered = notifications.filter(({ tag: nTag }) => nTag === tag)
      log(`[sw:push] ${nid} - found ${filtered.length} ${tag} notifications after manual tag filter`)
      log(`[sw:push] ${nid} - manual tag filter: ${JSON.stringify(filtered.map(({ tag }) => tag))}`)

      if (immediatelyShowNotification(tag)) {
        // we can't rely on the tag property to replace notifications on Safari on iOS.
        // we therefore close them manually and then we display the notification.
        log(`[sw:push] ${nid} - ${tag} notifications replace previous notifications`)
        setAppBadge(sw, ++activeCount)
        // due to missing proper tag support in Safari on iOS, we can't rely on the tag property to replace notifications.
        // see https://bugs.webkit.org/show_bug.cgi?id=258922 for more information
        // we therefore fetch all notifications with the same tag (+ manual filter),
        // close them and then we display the notification.
        const notifications = await sw.registration.getNotifications({ tag })
        // we only close notifications manually on iOS because we don't want to degrade android UX just because iOS is behind in their support.
        if (iOS()) {
          log(`[sw:push] ${nid} - closing existing notifications`)
          notifications.filter(({ tag: nTag }) => nTag === tag).forEach(n => n.close())
        }
        log(`[sw:push] ${nid} - show notification with title "${payload.title}"`)
        return await sw.registration.showNotification(payload.title, payload.options)
      }

      // according to the spec, there should only be zero or one notification since we used a tag filter
      // handle zero case here
      if (notifications.length === 0) {
        // incoming notification is first notification with this tag
        log(`[sw:push] ${nid} - no existing ${tag} notifications found`)
        setAppBadge(sw, ++activeCount)
        log(`[sw:push] ${nid} - show notification with title "${payload.title}"`)
        return await sw.registration.showNotification(payload.title, payload.options)
      }

      // handle unexpected case here
      if (notifications.length > 1) {
        log(`[sw:push] ${nid} - more than one notification with tag ${tag} found`, 'error')
        // due to missing proper tag support in Safari on iOS,
        // we only acknowledge this error in our logs and don't bail here anymore
        // see https://bugs.webkit.org/show_bug.cgi?id=258922 for more information
        log(`[sw:push] ${nid} - skip bail -- merging notifications with tag ${tag} manually`)
        // return null
      }

      return await mergeAndShowNotification(sw, payload, notifications, tag, nid)
    })())
  }
}

// if there is no tag or it's a TIP, FORWARDEDTIP or EARN notification
// we don't need to merge notifications and thus the notification should be immediately shown using `showNotification`
const immediatelyShowNotification = (tag) => !tag || ['TIP', 'FORWARDEDTIP', 'EARN', 'STREAK'].includes(tag.split('-')[0])

const mergeAndShowNotification = async (sw, payload, currentNotifications, tag, nid) => {
  // sanity check
  const otherTagNotifications = currentNotifications.filter(({ tag: nTag }) => nTag !== tag)
  if (otherTagNotifications.length > 0) {
    // we can't recover from this here. bail.
    const message = `[sw:push] ${nid} - bailing -- more than one notification with tag ${tag} found after manual filter`
    log(message, 'error')
    return
  }

  const { data: incomingData } = payload.options
  log(`[sw:push] ${nid} - incoming payload.options.data: ${JSON.stringify(incomingData)}`)

  // we can ignore everything after the first dash in the tag for our control flow
  const compareTag = tag.split('-')[0]
  log(`[sw:push] ${nid} - using ${compareTag} for control flow`)

  // merge notifications into single notification payload
  // ---
  // tags that need to know the amount of notifications with same tag for merging
  const AMOUNT_TAGS = ['REPLY', 'MENTION', 'REFERRAL', 'INVITE', 'FOLLOW', 'TERRITORY_POST']
  // tags that need to know the sum of sats of notifications with same tag for merging
  const SUM_SATS_TAGS = ['DEPOSIT']
  // this should reflect the amount of notifications that were already merged before
  let initialAmount = currentNotifications[0]?.data?.amount || 1
  if (iOS()) initialAmount = 1
  log(`[sw:push] ${nid} - initial amount: ${initialAmount}`)
  const mergedPayload = currentNotifications.reduce((acc, { data }) => {
    let newAmount, newSats
    if (AMOUNT_TAGS.includes(compareTag)) {
      newAmount = acc.amount + 1
    }
    if (SUM_SATS_TAGS.includes(compareTag)) {
      newSats = acc.sats + data.sats
    }
    const newPayload = { ...data, amount: newAmount, sats: newSats }
    return newPayload
  }, { ...incomingData, amount: initialAmount })

  log(`[sw:push] ${nid} - merged payload: ${JSON.stringify(mergedPayload)}`)

  // calculate title from merged payload
  const { amount, followeeName, subName, subType, sats } = mergedPayload
  let title = ''
  if (AMOUNT_TAGS.includes(compareTag)) {
    if (compareTag === 'REPLY') {
      title = `you have ${amount} new replies`
    } else if (compareTag === 'MENTION') {
      title = `you were mentioned ${amount} times`
    } else if (compareTag === 'REFERRAL') {
      title = `${amount} stackers joined via your referral links`
    } else if (compareTag === 'INVITE') {
      title = `your invite has been redeemed by ${amount} stackers`
    } else if (compareTag === 'FOLLOW') {
      title = `@${followeeName} ${subType === 'POST' ? `created ${amount} posts` : `replied ${amount} times`}`
    } else if (compareTag === 'TERRITORY_POST') {
      title = `you have ${amount} new posts in ~${subName}`
    }
  } else if (SUM_SATS_TAGS.includes(compareTag)) {
    // there is only DEPOSIT in this array
    title = `${numWithUnits(sats, { abbreviate: false })} were deposited in your account`
  }
  log(`[sw:push] ${nid} - calculated title: ${title}`)

  // close all current notifications before showing new one to "merge" notifications
  // we only do this on iOS because we don't want to degrade android UX just because iOS is behind in their support.
  if (iOS()) {
    log(`[sw:push] ${nid} - closing existing notifications`)
    currentNotifications.forEach(n => n.close())
  }

  const options = { icon: payload.options?.icon, tag, data: { url: '/notifications', ...mergedPayload } }
  log(`[sw:push] ${nid} - show notification with title "${title}"`)
  return await sw.registration.showNotification(title, options)
}

export function onNotificationClick (sw) {
  return (event) => {
    const url = event.notification.data?.url
    if (url) {
      event.waitUntil(sw.clients.openWindow(url))
    }
    activeCount = Math.max(0, activeCount - 1)
    if (activeCount === 0) {
      clearAppBadge(sw)
    } else {
      setAppBadge(sw, activeCount)
    }
    event.notification.close()
  }
}

export function onPushSubscriptionChange (sw) {
  // https://medium.com/@madridserginho/how-to-handle-webpush-api-pushsubscriptionchange-event-in-modern-browsers-6e47840d756f
  // `isSync` is passed if function was called because of 'SYNC_SUBSCRIPTION' event
  // this makes sure we can differentiate between 'pushsubscriptionchange' events and our custom 'SYNC_SUBSCRIPTION' event
  return async (event, isSync) => {
    let { oldSubscription, newSubscription } = event
    // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/pushsubscriptionchange_event
    // fallbacks since browser may not set oldSubscription and newSubscription
    log('[sw:handlePushSubscriptionChange] invoked')
    oldSubscription ??= await storage.getItem('subscription')
    newSubscription ??= await sw.registration.pushManager.getSubscription()
    if (!newSubscription) {
      if (isSync && oldSubscription?.swVersion === 2) {
        // service worker lost the push subscription somehow, we assume this is a bug -> resubscribe
        // see https://github.com/stackernews/stacker.news/issues/411#issuecomment-1790675861
        // NOTE: this is only run on IndexedDB subscriptions stored under service worker version 2 since this is not backwards compatible
        // see discussion in https://github.com/stackernews/stacker.news/pull/597
        log('[sw:handlePushSubscriptionChange] service worker lost subscription')
        actionChannelPort?.postMessage({ action: 'RESUBSCRIBE' })
        return
      }
      // no subscription exists at the moment
      log('[sw:handlePushSubscriptionChange] no existing subscription found')
      return
    }
    if (oldSubscription?.endpoint === newSubscription.endpoint) {
    // subscription did not change. no need to sync with server
      log('[sw:handlePushSubscriptionChange] old subscription matches existing subscription')
      return
    }
    // convert keys from ArrayBuffer to string
    newSubscription = JSON.parse(JSON.stringify(newSubscription))
    const variables = {
      endpoint: newSubscription.endpoint,
      p256dh: newSubscription.keys.p256dh,
      auth: newSubscription.keys.auth,
      oldEndpoint: oldSubscription?.endpoint
    }
    const query = `
    mutation savePushSubscription($endpoint: String!, $p256dh: String!, $auth: String!, $oldEndpoint: String!) {
      savePushSubscription(endpoint: $endpoint, p256dh: $p256dh, auth: $auth, oldEndpoint: $oldEndpoint) {
        id
      }
    }`
    const body = JSON.stringify({ query, variables })
    await fetch('/api/graphql', {
      method: 'POST',
      headers: {
        'Content-type': 'application/json'
      },
      body
    })
    log('[sw:handlePushSubscriptionChange] synced push subscription with server', 'info', { endpoint: variables.endpoint, oldEndpoint: variables.oldEndpoint })
    await storage.setItem('subscription', JSON.parse(JSON.stringify(newSubscription)))
  }
}

export function onMessage (sw) {
  return (event) => {
    if (event.data.action === ACTION_PORT) {
      actionChannelPort = event.ports[0]
      return
    }
    if (event.data.action === STORE_OS) {
      os = event.data.os
      return
    }
    if (event.data.action === MESSAGE_PORT) {
      messageChannelPort = event.ports[0]
    }
    log('[sw:message] received message', 'info', { action: event.data.action })
    if (event.data.action === STORE_SUBSCRIPTION) {
      log('[sw:message] storing subscription in IndexedDB', 'info', { endpoint: event.data.subscription.endpoint })
      return event.waitUntil(storage.setItem('subscription', { ...event.data.subscription, swVersion: 2 }))
    }
    if (event.data.action === SYNC_SUBSCRIPTION) {
      return event.waitUntil(onPushSubscriptionChange(sw)(event, true))
    }
    if (event.data.action === DELETE_SUBSCRIPTION) {
      return event.waitUntil(storage.removeItem('subscription'))
    }
    if (event.data.action === CLEAR_NOTIFICATIONS) {
      return event.waitUntil((async () => {
        let notifications = []
        try {
          notifications = await sw.registration.getNotifications()
        } catch (err) {
          console.error('failed to get notifications')
        }
        notifications.forEach(notification => notification.close())
        activeCount = 0
        return await clearAppBadge(sw)
      })())
    }
  }
}
