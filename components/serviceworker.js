import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Workbox } from 'workbox-window'
import { gql, useMutation } from '@apollo/client'
import { useLogger } from './logger'

const applicationServerKey = process.env.NEXT_PUBLIC_VAPID_PUBKEY

const ServiceWorkerContext = createContext()

export const ServiceWorkerProvider = ({ children }) => {
  const [registration, setRegistration] = useState(null)
  const [support, setSupport] = useState({ serviceWorker: undefined, pushManager: undefined })
  const [permission, setPermission] = useState({ notification: undefined })
  const [savePushSubscription] = useMutation(
    gql`
      mutation savePushSubscription(
        $endpoint: String!
        $p256dh: String!
        $auth: String!
      ) {
        savePushSubscription(
          endpoint: $endpoint
          p256dh: $p256dh
          auth: $auth
        ) {
          id
        }
      }
    `)
  const [deletePushSubscription] = useMutation(
    gql`
        mutation deletePushSubscription($endpoint: String!) {
          deletePushSubscription(endpoint: $endpoint) {
            id
          }
        }
      `)
  const logger = useLogger()

  // I am not entirely sure if this is needed since at least in Brave,
  // using `registration.pushManager.subscribe` also prompts the user.
  // However, I am keeping this here since that's how it's done in most guides.
  // Could be that this is required for the `registration.showNotification` call
  // to work or that some browsers will break without this.
  const requestNotificationPermission = useCallback(() => {
    // https://web.dev/push-notifications-subscribing-a-user/#requesting-permission
    return new Promise(function (resolve, reject) {
      const permission = window.Notification.requestPermission(function (result) {
        resolve(result)
      })
      if (permission) {
        permission.then(resolve, reject)
      }
    }).then(function (permission) {
      setPermission({ notification: permission })
      if (permission === 'granted') return subscribeToPushNotifications()
    })
  })

  const subscribeToPushNotifications = async () => {
    const subscribeOptions = { userVisibleOnly: true, applicationServerKey }
    // Brave users must enable a flag in brave://settings/privacy first
    // see https://stackoverflow.com/a/69624651
    let pushSubscription = await registration.pushManager.subscribe(subscribeOptions)
    const { endpoint } = pushSubscription
    logger.info('subscribed to push notifications', { endpoint })
    // convert keys from ArrayBuffer to string
    pushSubscription = JSON.parse(JSON.stringify(pushSubscription))
    // Send subscription to service worker to save it so we can use it later during `pushsubscriptionchange`
    // see https://medium.com/@madridserginho/how-to-handle-webpush-api-pushsubscriptionchange-event-in-modern-browsers-6e47840d756f
    navigator.serviceWorker.controller.postMessage({
      action: 'STORE_SUBSCRIPTION',
      subscription: pushSubscription
    })
    logger.info('sent STORE_SUBSCRIPTION to service worker', { endpoint })
    // send subscription to server
    const variables = {
      endpoint,
      p256dh: pushSubscription.keys.p256dh,
      auth: pushSubscription.keys.auth
    }
    await savePushSubscription({ variables })
    logger.info('sent push subscription to server', { endpoint })
  }

  const unsubscribeFromPushNotifications = async (subscription) => {
    await subscription.unsubscribe()
    const { endpoint } = subscription
    logger.info('unsubscribed from push notifications', { endpoint })
    await deletePushSubscription({ variables: { endpoint } })
    // also delete push subscription in IndexedDB so we can tell if the user disabled push subscriptions
    // or we lost the push subscription due to a bug
    navigator.serviceWorker.controller.postMessage({ action: 'DELETE_SUBSCRIPTION' })
    logger.info('deleted push subscription from server', { endpoint })
  }

  const togglePushSubscription = useCallback(async () => {
    const pushSubscription = await registration.pushManager.getSubscription()
    if (pushSubscription) {
      return unsubscribeFromPushNotifications(pushSubscription)
    }
    return subscribeToPushNotifications()
  })

  useEffect(() => {
    setSupport({
      serviceWorker: 'serviceWorker' in navigator,
      notification: 'Notification' in window,
      pushManager: 'PushManager' in window
    })
    setPermission({ notification: 'Notification' in window ? window.Notification.permission : 'denied' })

    if (!('serviceWorker' in navigator)) {
      logger.info('device does not support service worker')
      return
    }

    const wb = new Workbox('/sw.js', { scope: '/' })
    wb.register().then(registration => {
      logger.info('service worker registration successful')
      setRegistration(registration)
    })
  }, [])

  useEffect(() => {
    // wait until successful registration
    if (!registration) return
    // setup channel between app and service worker
    const channel = new MessageChannel()
    navigator?.serviceWorker?.controller?.postMessage({ action: 'ACTION_PORT' }, [channel.port2])
    channel.port1.onmessage = (event) => {
      if (event.data.action === 'RESUBSCRIBE') {
        return subscribeToPushNotifications()
      }
    }
    // since (a lot of) browsers don't support the pushsubscriptionchange event,
    // we sync with server manually by checking on every page reload if the push subscription changed.
    // see https://medium.com/@madridserginho/how-to-handle-webpush-api-pushsubscriptionchange-event-in-modern-browsers-6e47840d756f
    navigator?.serviceWorker?.controller?.postMessage?.({ action: 'SYNC_SUBSCRIPTION' })
    logger.info('sent SYNC_SUBSCRIPTION to service worker')
  }, [registration])

  return (
    <ServiceWorkerContext.Provider value={{ registration, support, permission, requestNotificationPermission, togglePushSubscription }}>
      {children}
    </ServiceWorkerContext.Provider>
  )
}

export function useServiceWorker () {
  return useContext(ServiceWorkerContext)
}
