import { createHmac } from 'node:crypto'
import { extractUrls } from '@/lib/md'
import { isJob } from '@/lib/item'
import path from 'node:path'
import { decodeProxyUrl } from '@/lib/url'
import { fetchWithTimeout } from '@/lib/fetch'

const imgProxyEnabled = process.env.NODE_ENV === 'production' ||
  (process.env.NEXT_PUBLIC_IMGPROXY_URL && process.env.IMGPROXY_SALT && process.env.IMGPROXY_KEY)

if (!imgProxyEnabled) {
  console.warn('IMGPROXY_* env vars not set, imgproxy calls are no-ops now')
}

const IMGPROXY_URL = process.env.IMGPROXY_URL_DOCKER || process.env.NEXT_PUBLIC_IMGPROXY_URL
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

export async function imgproxy ({ data: { id, forceFetch = false }, models }) {
  if (!imgProxyEnabled) return

  const item = await models.item.findUnique({ where: { id } })

  let imgproxyUrls = {}
  if (item.text) {
    imgproxyUrls = await createImgproxyUrls(id, item.text, { models, forceFetch })
  }
  if (item.url && !isJob(item)) {
    imgproxyUrls = { ...imgproxyUrls, ...(await createImgproxyUrls(id, item.url, { models, forceFetch })) }
  }

  console.log('[imgproxy] updating item', id, 'with urls', imgproxyUrls)

  await models.item.update({ where: { id }, data: { imgproxyUrls } })
}

export const createImgproxyUrls = async (id, text, { models, forceFetch }) => {
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
    let fetchUrl = url
    if (process.env.MEDIA_URL_DOCKER) {
      console.log('[imgproxy] id:', id, '-- replacing media url:', url)
      fetchUrl = url.replace(process.env.NEXT_PUBLIC_MEDIA_URL, process.env.MEDIA_URL_DOCKER)
      console.log('[imgproxy] id:', id, '-- with:', fetchUrl)
    }

    console.log('[imgproxy] id:', id, '-- processing url:', url)
    if (url.startsWith(IMGPROXY_URL)) {
      console.log('[imgproxy] id:', id, '-- proxy url, decoding original url:', url)
      // backwards compatibility: we used to replace image urls with imgproxy urls
      url = decodeProxyUrl(url)
      console.log('[imgproxy] id:', id, '-- original url:', url)
    }
    if (!(await isMediaURL(fetchUrl, { forceFetch }))) {
      console.log('[imgproxy] id:', id, '-- not image url:', url)
      continue
    }
    imgproxyUrls[url] = {}
    try {
      imgproxyUrls[url] = await getMetadata(fetchUrl)
      console.log('[imgproxy] id:', id, '-- dimensions:', imgproxyUrls[url])
    } catch (err) {
      console.log('[imgproxy] id:', id, '-- error getting dimensions (possibly not running imgproxy pro)', err)
    }
    for (const res of resolutions) {
      const [w, h] = res.split('x')
      const processingOptions = `/rs:fit:${w}:${h}`
      imgproxyUrls[url][`${w}w`] = createImgproxyPath({ url: fetchUrl, options: processingOptions })
    }
  }
  return imgproxyUrls
}

const getMetadata = async (url) => {
  // video metadata, dimensions, format
  const options = '/vm:1/d:1/f:1'
  const imgproxyUrl = new URL(createImgproxyPath({ url, options, pathname: '/info' }), IMGPROXY_URL).toString()
  const res = await fetch(imgproxyUrl)
  const { width, height, format, pages, video_streams: videoStreams } = await res.json()
  return { dimensions: { width, height }, format, video: !!videoStreams?.length, pdf: format === 'pdf', pages: pages || 1 }
}

const createImgproxyPath = ({ url, pathname = '/', options }) => {
  // pdf processing, pg:1 for first page, q:90 for quality, cc:ffffff for white background, dpr:2 for retina
  if (url.endsWith('.pdf')) {
    options = `/pg:1${options}/q:90/cc:ffffff/dpr:2`
  }

  const b64Url = Buffer.from(url, 'utf-8').toString('base64url')
  const target = path.join(options, b64Url)
  const signature = sign(target)
  return path.join(pathname, signature, target)
}

const isMediaURL = async (url, { forceFetch }) => {
  if (cache.has(url)) return cache.get(url)

  if (!forceFetch && matchUrl(imageUrlMatchers, url)) {
    return true
  }
  if (!forceFetch && matchUrl(exclude, url)) {
    return false
  }

  let isMedia

  // first run HEAD with small timeout
  try {
    // https://stackoverflow.com/a/68118683
    const res = await fetchWithTimeout(url, { timeout: 1000, method: 'HEAD' })
    const buf = await res.blob()
    isMedia = buf.type.startsWith('image/') || buf.type.startsWith('video/' || buf.type === 'application/pdf')
  } catch (err) {
    console.log(url, err)
  }

  // For HEAD requests, positives are most likely true positives.
  // However, negatives may be false negatives
  if (isMedia) {
    cache.set(url, true)
    return true
  }

  // if not known yet, run GET request with longer timeout
  try {
    const res = await fetchWithTimeout(url, { timeout: 10000 })
    const buf = await res.blob()
    isMedia = buf.type.startsWith('image/') || buf.type.startsWith('video/' || buf.type === 'application/pdf')
  } catch (err) {
    console.log(url, err)
  }

  cache.set(url, isMedia)
  return isMedia
}

const hexDecode = (hex) => Buffer.from(hex, 'hex')

const sign = (target) => {
  // https://github.com/imgproxy/imgproxy/blob/master/examples/signature.js
  const hmac = createHmac('sha256', hexDecode(IMGPROXY_KEY))
  hmac.update(hexDecode(IMGPROXY_SALT))
  hmac.update(target)
  return hmac.digest('base64url')
}
