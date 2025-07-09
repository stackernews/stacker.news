import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { Workbox } from 'workbox-window'
import { gql, useMutation } from '@apollo/client'

const applicationServerKey = process.env.NEXT_PUBLIC_VAPID_PUBKEY

const ServiceWorkerContext = createContext()

// message types for communication between app and service worker
export const DELETE_SUBSCRIPTION = 'DELETE_SUBSCRIPTION'
export const STORE_SUBSCRIPTION = 'STORE_SUBSCRIPTION'
export const CLEAR_NOTIFICATIONS = 'CLEAR_NOTIFICATIONS'

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
    // serviceWorker.controller is null on forced refreshes
    // see https://w3c.github.io/ServiceWorker/#navigator-service-worker-controller
    if (!navigator.serviceWorker.controller) {
      throw new Error('no active service worker found. try refreshing page.')
    }
    const subscribeOptions = { userVisibleOnly: true, applicationServerKey }
    // Brave users must enable a flag in brave://settings/privacy first
    // see https://stackoverflow.com/a/69624651
    let pushSubscription = await registration.pushManager.subscribe(subscribeOptions)
    const { endpoint } = pushSubscription
    // convert keys from ArrayBuffer to string
    pushSubscription = JSON.parse(JSON.stringify(pushSubscription))
    // Send subscription to service worker to save it so we can use it later during `pushsubscriptionchange`
    // see https://medium.com/@madridserginho/how-to-handle-webpush-api-pushsubscriptionchange-event-in-modern-browsers-6e47840d756f
    navigator.serviceWorker.controller.postMessage({
      action: STORE_SUBSCRIPTION,
      subscription: pushSubscription
    })
    // send subscription to server
    const variables = {
      endpoint,
      p256dh: pushSubscription.keys.p256dh,
      auth: pushSubscription.keys.auth
    }
    await savePushSubscription({ variables })
  }

  const unsubscribeFromPushNotifications = async (subscription) => {
    await subscription.unsubscribe()
    const { endpoint } = subscription
    await deletePushSubscription({ variables: { endpoint } })
    navigator.serviceWorker.controller.postMessage({ action: DELETE_SUBSCRIPTION })
  }

  const togglePushSubscription = useCallback(async () => {
    const pushSubscription = await registration.pushManager.getSubscription()
    if (pushSubscription) {
      return await unsubscribeFromPushNotifications(pushSubscription)
    }
    await subscribeToPushNotifications()
    // request persistent storage: https://web.dev/learn/pwa/offline-data#data_persistence
    const persisted = await navigator?.storage?.persisted?.()
    if (!persisted && navigator?.storage?.persist) {
      return await navigator.storage.persist()
    }
  })

  useEffect(() => {
    setSupport({
      serviceWorker: 'serviceWorker' in navigator,
      notification: 'Notification' in window,
      pushManager: 'PushManager' in window
    })
    setPermission({ notification: 'Notification' in window ? window.Notification.permission : 'denied' })

    if (!('serviceWorker' in navigator)) {
      return
    }

    const wb = new Workbox('/sw.js', { scope: '/' })
    wb.register().then(registration => {
      setRegistration(registration)
    })
  }, [])

  const contextValue = useMemo(() => ({
    registration,
    support,
    permission,
    requestNotificationPermission,
    togglePushSubscription
  }), [registration, support, permission, requestNotificationPermission, togglePushSubscription])

  return (
    <ServiceWorkerContext.Provider value={contextValue}>
      {children}
    </ServiceWorkerContext.Provider>
  )
}

export function clearNotifications () {
  return navigator.serviceWorker?.controller?.postMessage({ action: CLEAR_NOTIFICATIONS })
}

export function useServiceWorker () {
  return useContext(ServiceWorkerContext)
}
