import { createHmac } from 'node:crypto'
import path from 'node:path'
import { isSafeMediaUrl } from './url'

export const imgProxyEnabled = process.env.NODE_ENV === 'production' ||
  (process.env.NEXT_PUBLIC_IMGPROXY_URL && process.env.IMGPROXY_SALT && process.env.IMGPROXY_KEY)

// in dev we may use MEDIA_URL_DOCKER or NEXT_PUBLIC_MEDIA_URL
// in prod we use NEXT_PUBLIC_MEDIA_DOMAIN
const MEDIA_URL = process.env.MEDIA_URL_DOCKER || process.env.NEXT_PUBLIC_MEDIA_URL || `https://${process.env.NEXT_PUBLIC_MEDIA_DOMAIN}`
const PUBLIC_IMGPROXY_URL = process.env.NEXT_PUBLIC_IMGPROXY_URL

const IMGPROXY_SALT = process.env.IMGPROXY_SALT
const IMGPROXY_KEY = process.env.IMGPROXY_KEY

export const createImgproxyPath = ({ url, pathname = '/', options }) => {
  const b64Url = Buffer.from(url, 'utf-8').toString('base64url')
  const target = path.join(options, b64Url)
  const signature = sign(target)
  return path.join(pathname, signature, target)
}

const hexDecode = (hex) => Buffer.from(hex, 'hex')

const sign = (target) => {
  // https://github.com/imgproxy/imgproxy/blob/master/examples/signature.js
  const hmac = createHmac('sha256', hexDecode(IMGPROXY_KEY))
  hmac.update(hexDecode(IMGPROXY_SALT))
  hmac.update(target)
  return hmac.digest('base64url')
}

/** resize an Upload to (width, height) via imgproxy, returning a public-facing URL.
 *
 * `padding` > 0 insets the content with a centered `backgroundColor` gutter,
 * creating a safe zone for consumers that crop the canvas edges (e.g. Android adaptive icons).
 *
 * `format` is the image format to use, defaults to 'png'.
 */
export function processResize ({ photoId, width, height, padding = 0, backgroundColor, format = 'png' }) {
  const innerWidth = width - 2 * padding
  const innerHeight = height - 2 * padding

  const opts = [`/rs:fill:${innerWidth}:${innerHeight}`]
  if (padding > 0) opts.push(`/pd:${padding}`)
  if (backgroundColor) opts.push(`/bg:${backgroundColor.replace('#', '')}`)
  if (format) opts.push(`/f:${format}`)

  const url = `${MEDIA_URL}/${photoId}`
  console.log('[imgproxy - resize] id:', photoId, '-- url:', url)

  const path = createImgproxyPath({ url, options: opts.join('') })
  return new URL(path, PUBLIC_IMGPROXY_URL).toString()
}

/** imgproxy paths for an external image at 1x and 2x, null if the url is not a safe media url.
 *
 * unlike the other helpers, the paths have no host, because they are saved in the database like imgproxyUrls.
 *
 * `size` is the longest side in css pixels, `resize` is 'fit' or 'fill' (crops to a square).
 */
function processExternalImage ({ url, size, resize = 'fit' }) {
  if (!isSafeMediaUrl(url)) return null
  // without imgproxy (local dev), use the original url
  if (!imgProxyEnabled) return { src: url }

  const at = density => createImgproxyPath({ url, options: `/rs:${resize}:${size * density}:${size * density}` })
  return { src: at(1), src2x: at(2) }
}

// image sizes of an embed card: 40px avatars, pictures as wide as the card
export const embedAvatar = url => processExternalImage({ url, size: 40, resize: 'fill' })
export const embedPicture = url => processExternalImage({ url, size: 550 })

export async function processCrop ({ photoId, cropData }) {
  const { x, y, width, height, originalWidth, originalHeight } = cropData
  const cropWidth = Math.round(originalWidth * width)
  const cropHeight = Math.round(originalHeight * height)

  const centerX = x + width / 2
  const centerY = y + height / 2

  const size = 200 // 200px avatar size

  const options = [
    `/crop:${cropWidth}:${cropHeight}`,
    `/gravity:fp:${centerX}:${centerY}`,
    `/rs:fill:${size}:${size}`
  ].join('')

  const url = `${MEDIA_URL}/${photoId}`
  console.log('[imgproxy - cropjob] id:', photoId, '-- url:', url)

  const pathname = '/'
  const path = createImgproxyPath({ url, pathname, options })

  return new URL(path, PUBLIC_IMGPROXY_URL).toString()
}
