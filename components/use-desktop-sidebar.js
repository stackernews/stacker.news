import { useSyncExternalStore } from 'react'

const query = '(min-width: 768px)'
const subscribe = callback => {
  const media = window.matchMedia(query)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
const getSnapshot = () => window.matchMedia(query).matches
const getServerSnapshot = () => false

export default function useDesktopSidebar () {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
