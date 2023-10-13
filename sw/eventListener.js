import ServiceWorkerStorage from 'serviceworker-storage'
import { numWithUnits } from '../lib/format'

// we store existing push subscriptions to keep them in sync with server
const storage = new ServiceWorkerStorage('sw:storage', 1)

// for communication between app and service worker
// see https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel
let messageChannelPort

export function onPush (sw) {
  return async (event) => {
    const payload = event.data?.json()
    if (!payload) return
    const { tag } = payload.options
    event.waitUntil((async () => {
      // TIP and EARN notifications simply replace the previous notifications
      if (!tag || ['TIP', 'EARN'].includes(tag.split('-')[0])) {
        return sw.registration.showNotification(payload.title, payload.options)
      }

      const notifications = await sw.registration.getNotifications({ tag })
      // since we used a tag filter, there should only be zero or one notification
      if (notifications.length > 1) {
        const message = `[sw:push] more than one notification with tag ${tag} found`
        messageChannelPort?.postMessage({ level: 'error', message })
        console.error(message)
        return null
      }
      if (notifications.length === 0) {
        return sw.registration.showNotification(payload.title, payload.options)
      }
      const currentNotification = notifications[0]
      const amount = currentNotification.data?.amount ? currentNotification.data.amount + 1 : 2
      let newTitle = ''
      const data = {}
      if (tag === 'REPLY') {
        newTitle = `You have ${amount} new replies`
      } else if (tag === 'MENTION') {
        newTitle = `You were mentioned ${amount} times`
      } else if (tag === 'REFERRAL') {
        newTitle = `${amount} stackers joined via your referral links`
      } else if (tag === 'INVITE') {
        newTitle = `your invite has been redeemed by ${amount} stackers`
      } else if (tag === 'DEPOSIT') {
        const currentSats = currentNotification.data.sats
        const incomingSats = payload.options.data.sats
        const newSats = currentSats + incomingSats
        data.sats = newSats
        newTitle = `${numWithUnits(newSats, { abbreviate: false })} were deposited in your account`
      }
      currentNotification.close()
      const { icon } = currentNotification
      return sw.registration.showNotification(newTitle, { icon, tag, data: { url: '/notifications', amount, ...data } })
    })())
  }
}

export function onNotificationClick (sw) {
  return (event) => {
    const url = event.notification.data?.url
    if (url) {
      event.waitUntil(sw.clients.openWindow(url))
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
  }
}
