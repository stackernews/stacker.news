import { createHmac } from 'node:crypto'
import path from 'node:path'

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
