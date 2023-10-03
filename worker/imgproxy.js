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

// based on heuristics. see https://stacker.news/items/266838
const imageUrlMatchers = [
  u => u.host === 'i.postimg.cc',
  u => u.host === 'pbs.twimg.com',
  u => u.host === 'i.ibb.co',
  u => u.host === 'nostr.build' || u.host === 'cdn.nostr.build',
  u => u.host === 'www.zapread.com' && u.pathname.startsWith('/i'),
  u => u.host === 'i.imgflip.com',
  u => u.host === 'i.redd.it',
  u => u.host === 'media.tenor.com',
  u => u.host === 'i.imgur.com'
]
const exclude = [
  u => u.protocol === 'mailto:',
  u => u.host.endsWith('.onion') || u.host.endsWith('.b32.ip') || u.host.endsWith('.loki'),
  u => ['twitter.com', 'x.com', 'nitter.it', 'nitter.at'].some(h => h === u.host),
  u => u.host === 'stacker.news',
  u => u.host === 'news.ycombinator.com',
  u => u.host === 'www.youtube.com' || u.host === 'youtu.be',
  u => u.host === 'github.com'
]

function matchUrl (matchers, url) {
  try {
    return matchers.some(matcher => matcher(new URL(url)))
  } catch (err) {
    console.log(url, err)
    return false
  }
}

function decodeOriginalUrl (imgproxyUrl) {
  const parts = imgproxyUrl.split('/')
  const b64Url = parts[parts.length - 1]
  const originalUrl = Buffer.from(b64Url, 'base64url').toString('utf-8')
  return originalUrl
}

export function imgproxy ({ models }) {
  return async function ({ data: { id, forceFetch = false } }) {
    if (!imgProxyEnabled) return

    console.log('running imgproxy job', id)

    const item = await models.item.findUnique({ where: { id } })

    const isJob = typeof item.maxBid !== 'undefined'

    let imgproxyUrls = {}
    try {
      if (item.text) {
        imgproxyUrls = await createImgproxyUrls(id, item.text, { forceFetch })
      }
      if (item.url && !isJob) {
        imgproxyUrls = { ...imgproxyUrls, ...(await createImgproxyUrls(id, item.url, { forceFetch })) }
      }
    } catch (err) {
      console.log('[imgproxy] error:', err)
      // rethrow for retry
      throw err
    }

    console.log('[imgproxy] updating item', id, 'with urls', imgproxyUrls)

    await models.item.update({ where: { id }, data: { imgproxyUrls } })
  }
}

export const createImgproxyUrls = async (id, text, { forceFetch }) => {
  const urls = extractUrls(text)
  console.log('[imgproxy] id:', id, '-- extracted urls:', urls)
  // resolutions that we target:
  //   - nHD:  640x 360
  //   - qHD:  960x 540
  //   - HD:  1280x 720
  //   - HD+: 1600x 900
  //   - FHD: 1920x1080
  //   - QHD: 2560x1440
  // reference:
  //   - https://en.wikipedia.org/wiki/Graphics_display_resolution#High-definition_(HD_and_derivatives)
  //   - https://www.browserstack.com/guide/ideal-screen-sizes-for-responsive-design
  const resolutions = ['640x360', '960x540', '1280x720', '1600x900', '1920x1080', '2560x1440']
  const imgproxyUrls = {}
  for (let url of urls) {
    if (!url) continue

    console.log('[imgproxy] id:', id, '-- processing url:', url)
    if (url.startsWith(IMGPROXY_URL)) {
      console.log('[imgproxy] id:', id, '-- proxy url, decoding original url:', url)
      // backwards compatibility: we used to replace image urls with imgproxy urls
      url = decodeOriginalUrl(url)
      console.log('[imgproxy] id:', id, '-- original url:', url)
    }
    if (!(await isImageURL(url, { forceFetch }))) {
      console.log('[imgproxy] id:', id, '-- not image url:', url)
      continue
    }
    imgproxyUrls[url] = {}
    for (const res of resolutions) {
      const [w, h] = res.split('x')
      const processingOptions = `/rs:fit:${w}:${h}`
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

const isImageURL = async (url, { forceFetch }) => {
  if (cache.has(url)) return cache.get(url)

  if (!forceFetch && matchUrl(imageUrlMatchers, url)) {
    return true
  }
  if (!forceFetch && matchUrl(exclude, url)) {
    return false
  }

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
