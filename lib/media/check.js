import { fetchWithTimeout } from '@/lib/fetch'

/**
 * checks if a URL points to video or image by calling media check endpoint
 * @param {string} endpoint - media check endpoint URL
 * @param {string} url - URL to check
 * @param {Object} [options] - options object
 * @param {AbortSignal} [options.signal] - abort signal for request cancellation
 * @returns {Promise<Object>} object with type property ('video', 'image', or 'unknown')
 */
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

/**
 * checks multiple URLs concurrently with configurable concurrency limit
 * @param {string[]} urls - array of URLs to check
 * @param {Object} [options] - options object
 * @param {number} [options.concurrency=8] - maximum number of concurrent requests
 * @param {AbortSignal} [options.signal] - abort signal for request cancellation
 * @returns {Promise<Map>} map of URL to check result objects
 */
export async function batchedCheckMedia (urls, { concurrency = 8, signal } = {}) {
  console.log('batchedCheckMedia urls:', urls)
  const queue = Array.from(new Set(urls)).filter(Boolean)
  const results = new Map()

  async function worker () {
    while (queue.length > 0) {
      const url = queue.shift()
      if (!url) break

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
