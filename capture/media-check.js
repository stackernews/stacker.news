import { filetypemime } from 'magic-bytes.js'

const TIMEOUT_HEAD = 2000
const TIMEOUT_GET = 10000
const BYTE_LIMIT = 8192

export function isImageMime (mime) { return typeof mime === 'string' && mime.startsWith('image/') }

export function isVideoMime (mime) { return typeof mime === 'string' && mime.startsWith('video/') }

// adapted from lib/time.js
function timeoutSignal (timeout) {
  const controller = new AbortController()

  if (timeout) {
    setTimeout(() => {
      controller.abort(new Error(`timeout after ${timeout / 1000}s`))
    }, timeout)
  }

  return controller.signal
}

const requiresAuth = (res) => res.status === 401 || res.status === 403

async function headMime (url, timeout = TIMEOUT_HEAD) {
  const res = await fetch(url, { method: 'HEAD', signal: timeoutSignal(timeout) })
  // bail on auth or forbidden
  if (requiresAuth(res)) return null

  return res.headers.get('content-type')
}

async function readMagicBytes (url, { timeout = TIMEOUT_GET, byteLimit = BYTE_LIMIT } = {}) {
  const res = await fetch(url, {
    method: 'GET',
    // accept image and video, but not other types
    headers: { Range: `bytes=0-${byteLimit - 1}`, Accept: 'image/*,video/*;q=0.9,*/*;q=0.8' },
    signal: timeoutSignal(timeout)
  })
  // bail on auth or forbidden
  if (requiresAuth(res)) return { bytes: null, headers: res.headers }

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

export default async function mediaCheck (req, res) {
  // express automatically decodes the values in req.params (using decodeURIComponent)
  let url = req.params.url
  if (typeof url !== 'string' || !/^(https?:\/\/)/.test(url)) {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  try {
    // in development, the capture container can't reach the public media url,
    // so we need to replace it with its docker equivalent, e.g. http://s3:4566/uploads
    if (url.startsWith(process.env.NEXT_PUBLIC_MEDIA_URL) && process.env.NODE_ENV === 'development') {
      url = url.replace(process.env.NEXT_PUBLIC_MEDIA_URL, process.env.MEDIA_URL_DOCKER)
    }

    // trying with HEAD first, as it's the cheapest option
    try {
      const ct = await headMime(url)
      if (isImageMime(ct) || isVideoMime(ct)) {
        return res.status(200).json({ mime: ct, isImage: isImageMime(ct), isVideo: isVideoMime(ct) })
      }
    } catch {}

    // otherwise, read the first bytes
    const { bytes, headers } = await readMagicBytes(url)
    const mimes = bytes ? filetypemime(bytes) : null
    const mime = mimes?.[0] ?? headers.get('content-type') ?? null
    return res.status(200).json({ mime, isImage: isImageMime(mime), isVideo: isVideoMime(mime) })
  } catch (err) {
    console.log('media check error:', err)
    return res.status(500).json({ mime: null, isImage: false, isVideo: false })
  }
}
