import { createHmac } from 'node:crypto'
import { extractUrls } from '../../../lib/md'

const imgProxyEnabled = process.env.NODE_ENV === 'production' ||
  (process.env.NEXT_PUBLIC_IMGPROXY_URL && process.env.IMGPROXY_SALT && process.env.IMGPROXY_KEY)

if (!imgProxyEnabled) {
  console.warn('IMGPROXY_* env vars not set, imgproxy calls are no-ops now')
}

const IMGPROXY_URL = process.env.NEXT_PUBLIC_IMGPROXY_URL
const IMGPROXY_SALT = process.env.IMGPROXY_SALT
const IMGPROXY_KEY = process.env.IMGPROXY_KEY

const hexDecode = (hex) => Buffer.from(hex, 'hex')

const sign = (target) => {
  // https://github.com/imgproxy/imgproxy/blob/master/examples/signature.js
  const hmac = createHmac('sha256', hexDecode(IMGPROXY_KEY))
  hmac.update(hexDecode(IMGPROXY_SALT))
  hmac.update(target)
  return hmac.digest('base64url')
}

const createImageProxyUrl = url => {
  const b64Url = Buffer.from(url, 'utf-8').toString('base64url')
  const target = `/${b64Url}`
  const signature = sign(target)
  return `${IMGPROXY_URL}${signature}${target}`
}

async function fetchWithTimeout (resource, { timeout = 1000, ...options } = {}) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  const response = await fetch(resource, {
    ...options,
    signal: controller.signal
  })
  clearTimeout(id)

  return response
}

const isImageURL = async url => {
  // https://stackoverflow.com/a/68118683
  try {
    const res = await fetchWithTimeout(url, { method: 'HEAD' })
    const buf = await res.blob()
    return buf.type.startsWith('image/')
  } catch (err) {
    console.log(url, err)
    return false
  }
}

export const proxyImages = async text => {
  if (!imgProxyEnabled) return text

  const urls = extractUrls(text)
  for (const url of urls) {
    if (url.startsWith(IMGPROXY_URL)) continue
    if (!(await isImageURL(url))) continue
    const proxyUrl = createImageProxyUrl(url)
    text = text.replaceAll(url, proxyUrl)
  }
  return text
}
