import { createHmac } from 'node:crypto'
import { extractUrls } from '../lib/md.js'

const imgProxyEnabled = process.env.NODE_ENV === 'production' ||
  (process.env.NEXT_PUBLIC_IMGPROXY_URL && process.env.IMGPROXY_SALT && process.env.IMGPROXY_KEY)

if (!imgProxyEnabled) {
  console.warn('IMGPROXY_* env vars not set, imgproxy calls are no-ops now')
}

const IMGPROXY_URL = process.env.NEXT_PUBLIC_IMGPROXY_URL
const IMGPROXY_SALT = process.env.IMGPROXY_SALT
const IMGPROXY_KEY = process.env.IMGPROXY_KEY

const cache = new Map()

function decodeOriginalUrl (imgproxyUrl) {
  const parts = imgproxyUrl.split('/')
  const b64Url = parts[parts.length - 1]
  const originalUrl = Buffer.from(b64Url, 'base64url').toString('utf-8')
  return originalUrl
}

export function imgproxy ({ models }) {
  return async function ({ data: { id } }) {
    if (!imgProxyEnabled) return

    console.log('running imgproxy job', id)

    const item = await models.item.findUnique({ where: { id } })

    const isJob = typeof item.maxBid !== 'undefined'

    let imgproxyUrls = {}
    try {
      if (item.text) {
        imgproxyUrls = await createImgproxyUrls(item.text)
      }
      if (item.url && !isJob) {
        imgproxyUrls = { ...imgproxyUrls, ...(await createImgproxyUrls(item.url)) }
      }
    } catch(err) {
      console.log("[imgproxy] error:", err)
      // rethrow for retry
      throw err
    }

    console.log("[imgproxy] updating item", id, "with urls", imgproxyUrls)

    await models.item.update({ where: { id }, data: { imgproxyUrls } })
  }
}

export const createImgproxyUrls = async (text) => {
  const urls = extractUrls(text)
  console.log("[imgproxy] extracted urls:", urls)
  // resolutions that we target:
  //   - nHD:  640x360
  //   - qHD:  960x540
  //   - HD:  1280x720
  //   - HD+: 1600x900
  //   - FHD: 1920x1080
  //   - QHD: 2560x1440
  // reference:
  //   - https://en.wikipedia.org/wiki/Graphics_display_resolution#High-definition_(HD_and_derivatives)
  //   - https://www.browserstack.com/guide/ideal-screen-sizes-for-responsive-design
  const widths = [640, 960, 1280, 1600, 1920, 2560]
  const imgproxyUrls = {}
  for (let url of urls) {
    console.log("[imgproxy] processing url:", url)
    if (url.startsWith(IMGPROXY_URL)) {
      console.log("[imgproxy] proxy url, decoding original url:", url)
      // backwards compatibility: we used to replace image urls with imgproxy urls
      url = decodeOriginalUrl(url)
      console.log("[imgproxy] original url:", url)
    }
    if (!(await isImageURL(url))) {
      console.log("[imgproxy] not image url:", url)
      continue
    }
    imgproxyUrls[url] = {}
    for (const w of widths) {
      const processingOptions = `/rs:fill:${w}`
      imgproxyUrls[url][`${w}w`] = createImgproxyUrl(url, processingOptions)
    }
  }
  return imgproxyUrls
}

const createImgproxyUrl = (url, processingOptions) => {
  const b64Url = Buffer.from(url, 'utf-8').toString('base64url')
  const target = `${processingOptions}/${b64Url}`
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
  if (cache.has(url)) return cache.get(url)

  let isImage

  // first run HEAD with small timeout
  try {
    // https://stackoverflow.com/a/68118683
    const res = await fetchWithTimeout(url, { timeout: 1000, method: 'HEAD' })
    const buf = await res.blob()
    isImage = buf.type.startsWith('image/')
  } catch (err) {
    console.log(url, err)
  }

  // For HEAD requests, positives are most likely true positives.
  // However, negatives may be false negatives
  if (isImage) {
    cache.set(url, true)
    return true
  }

  // if not known yet, run GET request with longer timeout
  try {
    const res = await fetchWithTimeout(url, { timeout: 10000 })
    const buf = await res.blob()
    isImage = buf.type.startsWith('image/')
  } catch (err) {
    console.log(url, err)
  }

  cache.set(url, isImage)
  return isImage
}

const hexDecode = (hex) => Buffer.from(hex, 'hex')

const sign = (target) => {
  // https://github.com/imgproxy/imgproxy/blob/master/examples/signature.js
  const hmac = createHmac('sha256', hexDecode(IMGPROXY_KEY))
  hmac.update(hexDecode(IMGPROXY_SALT))
  hmac.update(target)
  return hmac.digest('base64url')
}
