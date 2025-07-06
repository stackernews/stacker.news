import ServiceWorkerStorage from 'serviceworker-storage'
import { numWithUnits } from '@/lib/format'
import { CLEAR_NOTIFICATIONS, clearAppBadge, setAppBadge } from '@/lib/badge'
import { ACTION_PORT, DELETE_SUBSCRIPTION, MESSAGE_PORT, STORE_OS, STORE_SUBSCRIPTION, SYNC_SUBSCRIPTION } from '@/components/serviceworker'

// we store existing push subscriptions and OS to keep them in sync with server
const storage = new ServiceWorkerStorage('sw:storage', 1)

// for communication between app and service worker
// see https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel
let messageChannelPort
let actionChannelPort

// operating system. the value will be received via a STORE_OS message from app since service workers don't have access to window.navigator
let os = ''
async function getOS () {
  if (!os) {
    os = await storage.getItem('os') || ''
  }
  return os
}

// current push notification count for badge purposes
let activeCount = 0

// message event listener for communication between app and service worker
const log = (message, level = 'info', context) => {
  messageChannelPort?.postMessage({ level, message, context })
}

export function onPush (sw) {
  return (event) => {
    let payload = event.data?.json()
    if (!payload) return // ignore push events without payload, like isTrusted events
    const { tag } = payload.options
    const nid = crypto.randomUUID() // notification id for tracking

    // iOS requirement: group all promises
    const promises = []

    // On immediate notifications we update the counter
    if (immediatelyShowNotification(tag)) {
      promises.push(setAppBadge(sw, ++activeCount))
    } else {
      // Check if there are already notifications with the same tag and merge them
      promises.push(sw.registration.getNotifications({ tag }).then((notifications) => {
        if (notifications.length) {
          payload = mergeNotification(event, sw, payload, notifications, tag, nid)
        }
      }))
    }

    // iOS requirement: wait for all promises to resolve before showing the notification
    event.waitUntil(Promise.all(promises).then(() => {
      return sw.registration.showNotification(payload.title, payload.options)
    }))
  }
}

// if there is no tag or the tag is one of the following
// we show the notification immediately
const immediatelyShowNotification = (tag) =>
  !tag || ['TIP', 'FORWARDEDTIP', 'EARN', 'STREAK', 'TERRITORY_TRANSFER'].includes(tag.split('-')[0])

// merge notifications with the same tag
const mergeNotification = (event, sw, payload, currentNotifications, tag, nid) => {
  // sanity check
  const otherTagNotifications = currentNotifications.filter(({ tag: nTag }) => nTag !== tag)
  if (otherTagNotifications.length > 0) {
    // we can't recover from this here. bail.
    return
  }

  const { data: incomingData } = payload.options
  // we can ignore everything after the first dash in the tag for our control flow
  const compareTag = tag.split('-')[0]

  // merge notifications into single notification payload
  // ---
  // tags that need to know the amount of notifications with same tag for merging
  const AMOUNT_TAGS = ['REPLY', 'MENTION', 'ITEM_MENTION', 'REFERRAL', 'INVITE', 'FOLLOW', 'TERRITORY_POST']
  // tags that need to know the sum of sats of notifications with same tag for merging
  const SUM_SATS_TAGS = ['DEPOSIT', 'WITHDRAWAL']
  // this should reflect the amount of notifications that were already merged before
  const initialAmount = currentNotifications.length || 1
  const initialSats = currentNotifications[0]?.data?.sats || 0

  // currentNotifications.reduce causes iOS to sum n notifications + initialAmount which is already n notifications
  const mergedPayload = {
    ...incomingData,
    url: '/notifications', // when merged we should always go to the notifications page
    amount: initialAmount + 1,
    sats: initialSats + incomingData.sats
  }

  // calculate title from merged payload
  const { amount, followeeName, subName, subType, sats } = mergedPayload
  let title = ''
  if (AMOUNT_TAGS.includes(compareTag)) {
    if (compareTag === 'REPLY') {
      title = `you have ${amount} new replies`
    } else if (compareTag === 'MENTION') {
      title = `you were mentioned ${amount} times`
    } else if (compareTag === 'ITEM_MENTION') {
      title = `your items were mentioned ${amount} times`
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
    if (compareTag === 'DEPOSIT') {
      title = `${numWithUnits(sats, { abbreviate: false, unitSingular: 'sat was', unitPlural: 'sats were' })} deposited in your account`
    } else if (compareTag === 'WITHDRAWAL') {
      title = `${numWithUnits(sats, { abbreviate: false, unitSingular: 'sat was', unitPlural: 'sats were' })} withdrawn from your account`
    }
  }

  const options = { icon: payload.options?.icon, tag, data: { ...mergedPayload } }
  return { title, options } // send the new, merged, payload
}

// iOS-specific bug, notificationclick event only works when the app is closed
export function onNotificationClick (sw) {
  return (event) => {
    const promises = []
    const url = event.notification.data?.url
    if (url) {
      promises.push(sw.clients.openWindow(url))
    }
    activeCount = Math.max(0, activeCount - 1)
    if (activeCount === 0) {
      promises.push(clearAppBadge(sw))
    } else {
      promises.push(setAppBadge(sw, activeCount))
    }
    event.waitUntil(Promise.all(promises))
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
    oldSubscription ??= await storage.getItem('subscription')
    newSubscription ??= await sw.registration.pushManager.getSubscription()
    if (!newSubscription) {
      if (isSync && oldSubscription?.swVersion === 2) {
        // service worker lost the push subscription somehow, we assume this is a bug -> resubscribe
        // see https://github.com/stackernews/stacker.news/issues/411#issuecomment-1790675861
        // NOTE: this is only run on IndexedDB subscriptions stored under service worker version 2 since this is not backwards compatible
        // see discussion in https://github.com/stackernews/stacker.news/pull/597
        actionChannelPort?.postMessage({ action: 'RESUBSCRIBE' })
        return
      }
      // no subscription exists at the moment
      return
    }
    if (oldSubscription?.endpoint === newSubscription.endpoint) {
      // subscription did not change. no need to sync with server
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
    await storage.setItem('subscription', JSON.parse(JSON.stringify(newSubscription)))
  }
}

export function onMessage (sw) {
  return async (event) => {
    if (event.data.action === ACTION_PORT) {
      actionChannelPort = event.ports[0]
      return
    }
    if (event.data.action === STORE_OS) {
      event.waitUntil(storage.setItem('os', event.data.os))
      return
    }
    if (event.data.action === MESSAGE_PORT) {
      messageChannelPort = event.ports[0]
    }
    log('[sw:message] received message', 'info', { action: event.data.action })
    const currentOS = event.waitUntil(getOS())
    log('[sw:message] stored os: ' + currentOS, 'info', { action: event.data.action })
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
      const promises = []
      promises.push(sw.registration.getNotifications().then((notifications) => {
        notifications.forEach(notification => notification.close())
      }))
      promises.push(clearAppBadge(sw))
      activeCount = 0
      event.waitUntil(Promise.all(promises))
    }
  }
}
