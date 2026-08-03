// NOTE: keep this module free of imports so it can be unit tested in isolation

const YOUTUBE_HOSTS = ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be']
const YOUTUBE_TITLE_PLACEHOLDER = /^- YouTube$/i

function ensureProtocol (url) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`
}

export function isYoutubeUrl (url) {
  try {
    return YOUTUBE_HOSTS.includes(new URL(ensureProtocol(url)).hostname)
  } catch {
    return false
  }
}

// YouTube serves `- YouTube` as the document title when the page is rendered
// without JS, so we must not treat it as a real title
export function isUsefulYoutubeTitle (title) {
  return !!title && !YOUTUBE_TITLE_PLACEHOLDER.test(title.trim())
}

export async function fetchYoutubeTitle (url, fetchImpl) {
  if (!isYoutubeUrl(url)) return undefined
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(ensureProtocol(url))}&format=json`
    const response = await fetchImpl(oembedUrl)
    if (!response?.ok) return undefined
    const oembed = await response.json()
    return typeof oembed?.title === 'string' ? oembed.title : undefined
  } catch {
    return undefined
  }
}
