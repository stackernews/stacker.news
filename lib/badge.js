export const CLEAR_NOTIFICATIONS = 'CLEAR_NOTIFICATIONS'

export const clearNotifications = () => navigator.serviceWorker?.controller?.postMessage({ action: CLEAR_NOTIFICATIONS })

const badgingApiSupported = (sw = window) => 'setAppBadge' in sw.navigator

// we don't need this, we can use the badging API
/* const permissionGranted = async (sw = window) => {
  const name = 'notifications'
  let permission
  try {
    permission = await sw.navigator.permissions.query({ name })
  } catch (err) {
    console.error('Failed to check permissions', err)
  }
  return permission?.state === 'granted' || sw.Notification?.permission === 'granted'
} */

// Apple requirement: onPush doesn't accept async functions
export const setAppBadge = (sw = window, count) => {
  if (!badgingApiSupported(sw)) return
  try {
    return sw.navigator.setAppBadge(count) // Return a Promise to be handled
  } catch (err) {
    console.error('Failed to set app badge', err)
  }
}

export const clearAppBadge = (sw = window) => {
  if (!badgingApiSupported(sw)) return
  try {
    return sw.navigator.clearAppBadge() // Return a Promise to be handled
  } catch (err) {
    console.error('Failed to clear app badge', err)
  }
}
