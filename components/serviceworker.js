import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Workbox } from 'workbox-window'
import { gql, useMutation } from '@apollo/client'

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
    // convert keys from ArrayBuffer to string
    pushSubscription = JSON.parse(JSON.stringify(pushSubscription))
    const variables = {
      endpoint: pushSubscription.endpoint,
      p256dh: pushSubscription.keys.p256dh,
      auth: pushSubscription.keys.auth
    }
    await savePushSubscription({ variables })
  }

  const unsubscribeFromPushNotifications = async (subscription) => {
    await subscription.unsubscribe()
    const { endpoint } = subscription
    await deletePushSubscription({ variables: { endpoint } })
  }

  const togglePushSubscription = useCallback(async () => {
    const pushSubscription = await registration.pushManager.getSubscription()
    if (pushSubscription) return unsubscribeFromPushNotifications(pushSubscription)
    return subscribeToPushNotifications()
  })

  useEffect(() => {
    setSupport({
      serviceWorker: 'serviceWorker' in navigator,
      notification: 'Notification' in window,
      pushManager: 'PushManager' in window
    })
    setPermission({ notification: 'Notification' in window ? window.Notification.permission : 'denied' })
  }, [])

  useEffect(() => {
    if (!support.serviceWorker) return
    const wb = new Workbox('/sw.js', { scope: '/' })
    wb.register().then(registration => {
      setRegistration(registration)
    })
  }, [support.serviceWorker])

  return (
    <ServiceWorkerContext.Provider value={{ registration, support, permission, requestNotificationPermission, togglePushSubscription }}>
      {children}
    </ServiceWorkerContext.Provider>
  )
}

export function useServiceWorker () {
  return useContext(ServiceWorkerContext)
}
