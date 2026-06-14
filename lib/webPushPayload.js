import removeMd from 'remove-markdown'

const MARKDOWN_IMAGE_URL_REGEXP = /!\[[^\]]*]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/g
const URL_REGEXP = /https?:\/\/[^\s<>)]+/g
const IMAGE_URL_REGEXP = /\.(?:png|jpe?g|gif|webp)(?:[?#].*)?$/i

function normalizedHttpUrl (url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return
    return parsed.toString()
  } catch {
    return undefined
  }
}

function isPushImageUrl (url, imgproxyUrls) {
  const metadata = imgproxyUrls?.[url]
  if (metadata?.video) return false
  if (metadata) return true

  return IMAGE_URL_REGEXP.test(new URL(url).pathname)
}

export function firstPushImageUrl (markdown, imgproxyUrls) {
  if (typeof markdown !== 'string') return

  for (const match of markdown.matchAll(MARKDOWN_IMAGE_URL_REGEXP)) {
    const url = normalizedHttpUrl(match[1] || match[2])
    if (url && isPushImageUrl(url, imgproxyUrls)) return url
  }

  for (const match of markdown.matchAll(URL_REGEXP)) {
    const url = normalizedHttpUrl(match[0])
    if (url && isPushImageUrl(url, imgproxyUrls)) return url
  }
}

export function createPayload (notification) {
  // https://web.dev/push-notifications-display-a-notification/#visual-options
  // https://webkit.org/blog/16535/meet-declarative-web-push/
  // DEV: localhost in URLs is not supported by declarative web push
  let { title, body, imgproxyUrls, ...options } = notification
  if (body) {
    options.image ??= firstPushImageUrl(body, imgproxyUrls)
    body = removeMd(body).trim() || undefined
  }

  return JSON.stringify({
    web_push: 8030, // Declarative Web Push JSON format
    notification: {
      title,
      body,
      timestamp: Date.now(),
      icon: process.env.NEXT_PUBLIC_URL + '/icons/icon_x96.png',
      navigate: process.env.NEXT_PUBLIC_URL + '/notifications', // navigate is required
      app_badge: 1, // TODO: establish a proper badge count system
      ...options
    }
  })
}
