import { ensureProtocol } from './url'

const YOUTUBE_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be'])
const YOUTUBE_OEMBED_URL = 'https://www.youtube.com/oembed'
const TITLE_FALLBACK_TIMEOUT_MS = 3000
const TITLE_FALLBACK_SIZE = 64 * 1024

export function isYouTubeUrl (value) {
  try {
    const { hostname } = new URL(ensureProtocol(value))
    return YOUTUBE_HOSTS.has(hostname.toLowerCase())
  } catch {
    return false
  }
}

export function cleanPageTitle (title, url) {
  const normalized = title?.replace(/\s+/g, ' ').trim()
  if (!normalized) return

  if (isYouTubeUrl(url)) {
    if (/^-?\s*youtube$/i.test(normalized)) return

    const withoutSuffix = normalized.replace(/\s+-\s*youtube$/i, '').trim()
    if (withoutSuffix !== normalized) return withoutSuffix || undefined
  }

  return normalized
}

export function youTubeOEmbedUrl (url) {
  if (!isYouTubeUrl(url)) return

  const oembedUrl = new URL(YOUTUBE_OEMBED_URL)
  oembedUrl.searchParams.set('url', ensureProtocol(url))
  oembedUrl.searchParams.set('format', 'json')
  return oembedUrl.toString()
}

export async function fetchYouTubeOEmbedTitle (url, fetcher) {
  const oembedUrl = youTubeOEmbedUrl(url)
  if (!oembedUrl) return

  try {
    const response = await fetcher(oembedUrl, {
      timeout: TITLE_FALLBACK_TIMEOUT_MS,
      size: TITLE_FALLBACK_SIZE
    })
    if (!response.ok) return

    const data = await response.json()
    return cleanPageTitle(data?.title, url)
  } catch {}
}
