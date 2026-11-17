import { extractUrls } from '@/lib/md'
import { isJob } from '@/lib/item'
import { decodeProxyUrl } from '@/lib/url'
import { imgProxyEnabled, createImgproxyPath } from '@/lib/imgproxy'
import { snFetch } from '@/lib/fetch'
import internalFetch from '@/lib/egress/internal-fetch'

if (!imgProxyEnabled) {
  console.warn('IMGPROXY_* env vars not set, imgproxy calls are no-ops now')
}

const IMGPROXY_URL = process.env.IMGPROXY_URL_DOCKER || process.env.NEXT_PUBLIC_IMGPROXY_URL
const MEDIA_CHECK_URL = process.env.MEDIA_CHECK_URL_DOCKER || process.env.NEXT_PUBLIC_MEDIA_CHECK_URL

const cache = new Map()
// snFetch can fail to reach the gateway, or the gateway can report its own outage.
const retryableGatewayErrors = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'ERR_PROXY_UNAVAILABLE'])

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
  u => process.env.NODE_ENV === 'production' && u.protocol !== 'https:',
  u => ['.onion', '.i2p', '.loki'].some(suffix => u.hostname.endsWith(suffix)),
  u => ['twitter.com', 'x.com', 'nitter.it', 'nitter.at', 'xcancel.com'].some(h => h === u.host),
  u => u.host === 'stacker.news',
  u => u.host === 'news.ycombinator.com',
  u => u.host === 'www.youtube.com' || u.host === 'youtu.be',
  u => u.host === 'github.com'
]

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
  const res = await internalFetch(imgproxyUrl, { signal: AbortSignal.timeout(30000) })
  const { width, height, format, video_streams: videoStreams } = await res.json()
  return { dimensions: { width, height }, format, video: !!videoStreams?.length }
}

const isMediaURL = async (url, { forceFetch }) => {
  if (cache.has(url)) return cache.get(url)

  const parsed = URL.parse(url)
  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) return false
  if (!forceFetch) {
    if (imageUrlMatchers.some(matches => matches(parsed))) return true
    if (exclude.some(matches => matches(parsed))) return false
  }

  // primary: media check service
  try {
    console.log('[imgproxy] media check service url:', `${MEDIA_CHECK_URL}/${encodeURIComponent(url)}`)
    const res = await internalFetch(`${MEDIA_CHECK_URL}/${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(30000) })
    if (res.ok) {
      const data = await res.json()
      const isMedia = data.isImage || data.isVideo
      if (typeof isMedia !== 'boolean') throw new Error('missing media classification')
      cache.set(url, isMedia)
      console.log('[imgproxy] media check service response:', data)
      return isMedia
    }
    res.body?.destroy()
  } catch (err) {
    console.log('[imgproxy] media check service failed, falling back to gateway:', url, err)
  }

  for (const [method, timeout] of [['HEAD', 1000], ['GET', 10000]]) {
    try {
      const res = await snFetch(url, { method, timeout })
      const type = (res.headers.get('content-type') ?? '').toLowerCase()
      res.body?.destroy()
      const media = type.startsWith('image/') || type.startsWith('video/')
      if (media || method === 'GET') {
        cache.set(url, media)
        return media
      }
    } catch (err) {
      if (retryableGatewayErrors.has(err.code)) throw err
      console.log(url, err)
    }
  }

  // An inconclusive probe skips just this link. A later item can try it again.
  return false
}
