import { fetchWithTimeout } from '@/lib/fetch'

export async function checkMedia (endpoint, url, { signal } = {}) {
  try {
    const res = await fetchWithTimeout(`${endpoint}/${encodeURIComponent(url)}`, { signal, timeout: 10000 })
    if (!res.ok) throw new Error('failed to check media')
    const json = await res.json()
    console.log('media check response:', json)
    if (!json || (json.isVideo === undefined || json.isImage === undefined)) throw new Error('invalid media check response')
    // the fetch would return mime, isVideo, isImage
    const type = json.isVideo ? 'video' : json.isImage ? 'image' : 'unknown'
    return { type }
  } catch (error) {
    console.error('error checking media', error)
    return { type: 'unknown' }
  }
}

export async function batchedCheckMedia (urls, { concurrency = 8, signal } = {}) {
  console.log('batchedCheckMedia urls:', urls)
  const queue = Array.from(new Set(urls)).filter(Boolean)
  const results = new Map()

  async function worker () {
    for (const url of queue) {
      try {
        const result = await checkMedia(process.env.MEDIA_CHECK_URL_DOCKER || process.env.NEXT_PUBLIC_MEDIA_CHECK_URL, url, { signal })
        results.set(url, result)
      } catch (error) {
        console.error('error checking media', error)
        results.set(url, { type: 'unknown' })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))
  return results
}
