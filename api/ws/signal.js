import { Subject } from 'rxjs'

export const NEW_NOTES = 'NEW_NOTES'

export let Notification
if (process.env.NODE_ENV === 'production') {
  // Top-level code like this runs only once during production since NodeJS caches modules
  Notification = new Subject()
} else {
  // Using `global` prevents that this code is run multipe times
  // because of hot reloading during development
  if (!global.signal?.Notification) {
    global.signal = { ...global.signal, Notification: new Subject() }
  }
  Notification = global.signal.Notification
}
