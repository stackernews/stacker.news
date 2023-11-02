import ServiceWorkerStorage from 'serviceworker-storage'
import { numWithUnits } from '../lib/format'
import { clearAppBadge, setAppBadge } from '../lib/badge'

// we store existing push subscriptions to keep them in sync with server
const storage = new ServiceWorkerStorage('sw:storage', 1)

// for communication between app and service worker
// see https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel
let messageChannelPort

// keep track of item ids where we received a MENTION notification already to not show one again
const itemMentions = []

// track push ids to display a count in the app notification badge
const receivedPushIds = new Set()

export function onPush (sw) {
  return async (event) => {
    const payload = event.data?.json()
    if (!payload) return
    const { tag, data: { id } } = payload.options
    event.waitUntil((async () => {
      if (skipNotification(payload)) return
      if (immediatelyShowNotification(payload)) {
        receivedPushIds.add(id)
        setAppBadge(sw, receivedPushIds.size)
        return sw.registration.showNotification(payload.title, payload.options)
      }

      // fetch existing notifications with same tag
      const notifications = await sw.registration.getNotifications({ tag })

      // since we used a tag filter, there should only be zero or one notification
      if (notifications.length > 1) {
        const message = `[sw:push] more than one notification with tag ${tag} found`
        messageChannelPort?.postMessage({ level: 'error', message })
        console.error(message)
        return null
      }

      // save item id of MENTION notification so we can skip following ones
      if (tag === 'MENTION' && payload.options.data?.itemId) itemMentions.push(payload.options.data.itemId)

      if (notifications.length === 0) {
        receivedPushIds.add(id)
        setAppBadge(sw, receivedPushIds.size)
        // incoming notification is first notification with this tag
        return sw.registration.showNotification(payload.title, payload.options)
      }

      const currentNotification = notifications[0]
      receivedPushIds.add(id)
      setAppBadge(sw, receivedPushIds.size)
      return mergeAndShowNotification(sw, payload, currentNotification)
    })())
  }
}

const skipNotification = ({ options: { tag, data } }) => {
  return tag === 'MENTION' && itemMentions.includes(data.itemId)
}

// if there is no tag or it's a TIP, FORWARDEDTIP or EARN notification
// we don't need to merge notifications and thus the notification should be immediately shown using `showNotification`
const immediatelyShowNotification = ({ options: { tag } }) => !tag || ['TIP', 'FORWARDEDTIP', 'EARN'].includes(tag.split('-')[0])

const mergeAndShowNotification = (sw, payload, currentNotification) => {
  const { data: incomingData } = payload.options
  const { tag, data: currentData } = currentNotification

  // how many notification with this tag are there already?
  // (start from 2 and +1 to include incoming notification)
  const amount = currentNotification.data?.amount ? currentNotification.data.amount + 1 : 2

  let title = ''
  const newData = {}
  if (tag === 'REPLY') {
    title = `You have ${amount} new replies`
  } else if (tag === 'MENTION') {
    title = `You were mentioned ${amount} times`
  } else if (tag === 'REFERRAL') {
    title = `${amount} stackers joined via your referral links`
  } else if (tag === 'INVITE') {
    title = `your invite has been redeemed by ${amount} stackers`
  } else if (tag === 'DEPOSIT') {
    const currentSats = currentData.sats
    const incomingSats = incomingData.sats
    const newSats = currentSats + incomingSats
    title = `${numWithUnits(newSats, { abbreviate: false })} were deposited in your account`
    newData.sats = newSats
  }

  // close current notification before showing new one to "merge" notifications
  currentNotification.close()
  const newNotificationOptions = { icon: currentNotification.icon, tag, data: { url: '/notifications', amount, ...newData } }
  return sw.registration.showNotification(title, newNotificationOptions)
}

export function onNotificationClick (sw) {
  return (event) => {
    const { url, id } = event.notification.data || {}
    if (url) {
      event.waitUntil(sw.clients.openWindow(url))
    }
    if (id) {
      receivedPushIds.delete(id)
      if (receivedPushIds.size === 0) {
        clearAppBadge(sw)
      }
    }
    event.notification.close()
  }
}

export function onPushSubscriptionChange (sw) {
  // https://medium.com/@madridserginho/how-to-handle-webpush-api-pushsubscriptionchange-event-in-modern-browsers-6e47840d756f
  return async (oldSubscription, newSubscription) => {
    // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/pushsubscriptionchange_event
    // fallbacks since browser may not set oldSubscription and newSubscription
    messageChannelPort?.postMessage({ message: '[sw:handlePushSubscriptionChange] invoked' })
    oldSubscription ??= await storage.getItem('subscription')
    newSubscription ??= await sw.registration.pushManager.getSubscription()
    if (!newSubscription) {
    // no subscription exists at the moment
      messageChannelPort?.postMessage({ message: '[sw:handlePushSubscriptionChange] no existing subscription found' })
      return
    }
    if (oldSubscription?.endpoint === newSubscription.endpoint) {
    // subscription did not change. no need to sync with server
      messageChannelPort?.postMessage({ message: '[sw:handlePushSubscriptionChange] old subscription matches existing subscription' })
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
    messageChannelPort?.postMessage({ message: '[sw:handlePushSubscriptionChange] synced push subscription with server', context: { endpoint: variables.endpoint, oldEndpoint: variables.oldEndpoint } })
    await storage.setItem('subscription', JSON.parse(JSON.stringify(newSubscription)))
  }
}

export function onMessage (sw) {
  return (event) => {
    if (event.data.action === 'MESSAGE_PORT') {
      messageChannelPort = event.ports[0]
    }
    messageChannelPort?.postMessage({ message: '[sw:message] received message', context: { action: event.data.action } })
    if (event.data.action === 'STORE_SUBSCRIPTION') {
      messageChannelPort?.postMessage({ message: '[sw:message] storing subscription in IndexedDB', context: { endpoint: event.data.subscription.endpoint } })
      return event.waitUntil(storage.setItem('subscription', event.data.subscription))
    }
    if (event.data.action === 'SYNC_SUBSCRIPTION') {
      return event.waitUntil(onPushSubscriptionChange(sw)(event.oldSubscription, event.newSubscription))
    }
    if (event.data.action === 'CLEAR_BADGE') {
      receivedPushIds.clear()
      return event.waitUntil(clearAppBadge(sw))
    }
  }
}
