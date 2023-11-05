import ServiceWorkerStorage from 'serviceworker-storage'
import { numWithUnits } from '../lib/format'

// we store existing push subscriptions to keep them in sync with server
const storage = new ServiceWorkerStorage('sw:storage', 1)

// for communication between app and service worker
// see https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel
let messageChannelPort
let actionChannelPort

// keep track of item ids where we received a MENTION notification already to not show one again
const itemMentions = []

export function onPush (sw) {
  return async (event) => {
    const payload = event.data?.json()
    if (!payload) return
    const { tag } = payload.options
    event.waitUntil((async () => {
      if (skipNotification(payload)) return
      if (immediatelyShowNotification(payload)) {
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
        // incoming notification is first notification with this tag
        return sw.registration.showNotification(payload.title, payload.options)
      }

      const currentNotification = notifications[0]
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
  let newData = {}
  if (tag === 'REPLY') {
    title = `you have ${amount} new replies`
  } else if (tag === 'MENTION') {
    title = `you were mentioned ${amount} times`
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
  } else if (tag.split('-')[0] === 'FOLLOW') {
    const { followeeName, subType } = incomingData
    title = `@${followeeName} ${subType === 'POST' ? `created ${amount} posts` : `replied ${amount} times`}`
    newData = incomingData
  }

  // close current notification before showing new one to "merge" notifications
  currentNotification.close()
  const newNotificationOptions = { icon: currentNotification.icon, tag, data: { url: '/notifications', amount, ...newData } }
  return sw.registration.showNotification(title, newNotificationOptions)
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
  // `isSync` is passed if function was called because of 'SYNC_SUBSCRIPTION' event
  // this makes sure we can differentiate between 'pushsubscriptionchange' events and our custom 'SYNC_SUBSCRIPTION' event
  return async (event, isSync) => {
    let { oldSubscription, newSubscription } = event
    // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/pushsubscriptionchange_event
    // fallbacks since browser may not set oldSubscription and newSubscription
    messageChannelPort?.postMessage({ message: '[sw:handlePushSubscriptionChange] invoked' })
    oldSubscription ??= await storage.getItem('subscription')
    newSubscription ??= await sw.registration.pushManager.getSubscription()
    if (!newSubscription) {
      if (isSync && oldSubscription) {
        // service worker lost the push subscription somehow
        messageChannelPort?.postMessage({ message: '[sw:handlePushSubscriptionChange] service worker lost subscription' })
        actionChannelPort?.postMessage({ action: 'RESUBSCRIBE' })
        return
      }
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
    if (event.data.action === 'ACTION_PORT') {
      actionChannelPort = event.ports[0]
      return
    }
    if (event.data.action === 'MESSAGE_PORT') {
      messageChannelPort = event.ports[0]
    }
    messageChannelPort?.postMessage({ message: '[sw:message] received message', context: { action: event.data.action } })
    if (event.data.action === 'STORE_SUBSCRIPTION') {
      messageChannelPort?.postMessage({ message: '[sw:message] storing subscription in IndexedDB', context: { endpoint: event.data.subscription.endpoint } })
      return event.waitUntil(storage.setItem('subscription', event.data.subscription))
    }
    if (event.data.action === 'SYNC_SUBSCRIPTION') {
      return event.waitUntil(onPushSubscriptionChange(sw)(event, true))
    }
    if (event.data.action === 'DELETE_SUBSCRIPTION') {
      return event.waitUntil(storage.removeItem('subscription'))
    }
  }
}
