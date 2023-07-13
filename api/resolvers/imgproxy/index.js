import { createHmac } from 'node:crypto'
import { extractUrls } from '../../../lib/md'

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
  const processingOptions = '/rs:fit:600:500:0/g:no'
  const b64Url = Buffer.from(url, 'utf-8').toString('base64url')
  const target = `${processingOptions}/${b64Url}`
  const signature = sign(target)
  return `${IMGPROXY_URL}${signature}${target}`
}

const isImageURL = async url => {
  // https://stackoverflow.com/a/68118683
  try {
    const res = await fetch(url, { method: 'HEAD' })
    const buf = await res.blob()
    return buf.type.startsWith('image/')
  } catch (err) {
    console.log(err)
    return false
  }
}

export const proxyImages = async text => {
  const urls = extractUrls(text)
  for (const url of urls) {
    if (url.startsWith(IMGPROXY_URL)) continue
    if (!(await isImageURL(url))) continue
    const proxyUrl = createImageProxyUrl(url)
    text = text.replaceAll(url, proxyUrl)
  }
  return text
}
