// lib/media.js
import { fetchWithTimeout } from '@/lib/fetch'
import { filetypemime } from 'magic-bytes.js'

export function isImageMime (mime) {
  return typeof mime === 'string' && mime.startsWith('image/')
}

export function isVideoMime (mime) {
  return typeof mime === 'string' && mime.startsWith('video/')
}

async function readFirstBytes (url, { timeout = 2000, byteLimit = 8192 } = {}) {
  const res = await fetchWithTimeout(url, {
    timeout,
    method: 'GET',
    // accept image and video, but not other types
    headers: { Range: `bytes=0-${byteLimit - 1}`, Accept: 'image/*,video/*;q=0.9,*/*;q=0.8' }
  })

  // bail on basic authentication requirement
  const wwwAuth = res.headers.get('www-authenticate') || ''
  if (res.status === 401 && /basic/i.test(wwwAuth)) {
    throw new Error('basic authentication required')
  }

  // stream a small chunk if possible, otherwise read buffer
  if (res.body?.getReader) {
    const reader = res.body.getReader()
    let received = 0
    const chunks = []
    try {
      while (received < byteLimit) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.byteLength
      }
    } finally {
      try { reader.releaseLock?.() } catch {}
      try { res.body?.cancel?.() } catch {}
    }
    const buf = new Uint8Array(received)
    let offset = 0
    for (const c of chunks) {
      buf.set(c, offset)
      offset += c.byteLength
    }
    return { bytes: buf, headers: res.headers }
  } else {
    const ab = await res.arrayBuffer()
    const buf = new Uint8Array(ab.slice(0, byteLimit))
    return { bytes: buf, headers: res.headers }
  }
}

export async function tasteMediaUrl (url, { timeout = 2000, byteLimit = 8192 } = {}) {
  try {
    // trying with HEAD first, as it's the cheapest option
    // TODO: should we trust it?
    try {
      const head = await fetchWithTimeout(url, { timeout, method: 'HEAD' })
      // bail on basic authentication requirement
      const wwwAuth = head.headers.get('www-authenticate') || ''
      if (head.status === 401 && /basic/i.test(wwwAuth)) {
        return { mime: null, isImage: false, isVideo: false }
      }

      const ct = head.headers.get('content-type')
      if (isImageMime(ct) || isVideoMime(ct)) {
        return { mime: ct, isImage: isImageMime(ct), isVideo: isVideoMime(ct) }
      }
    } catch {}

    // otherwise, read the first bytes
    const { bytes, headers } = await readFirstBytes(url, { timeout, byteLimit })
    const mimes = filetypemime(bytes)
    const mime = mimes?.[0] ?? headers.get('content-type') ?? null
    return { mime, isImage: isImageMime(mime), isVideo: isVideoMime(mime) }
  } catch (err) {
    console.log('error', err)
    return { mime: null, isImage: false, isVideo: false }
  }
}
