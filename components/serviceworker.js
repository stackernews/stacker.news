import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Workbox } from 'workbox-window'
import { gql, useMutation } from '@apollo/client'

const applicationServerKey = process.env.NEXT_PUBLIC_VAPID_PUBKEY

const ServiceWorkerContext = createContext()

export const ServiceWorkerProvider = ({ children }) => {
  const [swRegistration, setSWRegistration] = useState(null)
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

  const requestNotificationPermission = useCallback(() => {
    // https://web.dev/push-notifications-subscribing-a-user/#requesting-permission
    return new Promise(function (resolve, reject) {
      const permission = Notification.requestPermission(function (result) {
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
    let pushSubscription = await swRegistration.pushManager.subscribe(subscribeOptions)
    // convert keys from ArrayBuffer to string
    pushSubscription = JSON.parse(JSON.stringify(pushSubscription))
    const variables = {
      endpoint: pushSubscription.endpoint,
      p256dh: pushSubscription.keys.p256dh,
      auth: pushSubscription.keys.auth
    }
    await savePushSubscription({ variables })
  }

  useEffect(() => {
    setSupport({
      serviceWorker: 'serviceWorker' in navigator,
      notification: 'Notification' in window,
      pushManager: 'PushManager' in window
    })
    setPermission({ notification: 'Notification' in window ? Notification.permission : 'denied' })
  }, [])

  useEffect(() => {
    if (!support.serviceWorker) return
    const wb = new Workbox('/sw.js', { scope: '/' })
    wb.register().then(registration => {
      setSWRegistration(registration)
    })
  }, [support.serviceWorker])

  return <ServiceWorkerContext.Provider value={{ support, permission, requestNotificationPermission }}>{children}</ServiceWorkerContext.Provider>
}

export function useServiceWorker () {
  return useContext(ServiceWorkerContext)
}
