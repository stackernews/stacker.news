import { tasteMediaUrl } from '@/lib/media'
import { lookup } from 'dns/promises'

function sameHost (value, host) {
  try {
    return new URL(value).host === host
  } catch {
    return false
  }
}

function fromUs (req) {
  const host = req.headers.host
  const referer = req.headers.referer
  const origin = req.headers.origin
  const secFetchSite = req.headers['sec-fetch-site']

  const sameSite = secFetchSite === 'same-origin' || secFetchSite === 'same-site'
  const fromUs = (referer && sameHost(referer, host)) || (origin && sameHost(origin, host))
  return sameSite && fromUs
}

// checks if the hostname is a private host RFC 1918
// if withDns is true, it will also check if the hostname resolves to a private IP
export async function isPrivateHost ({ hostname, withDns = false }) {
  if (!hostname) return false
  const lower = hostname.toLowerCase()

  // test obvious cases
  if (lower === 'localhost' || lower === '127.0.0.1') return true
  if (lower.endsWith('.local') || lower.endsWith('.internal')) return true

  if (/^(10\.|127\.|169\.254\.|192\.168\.)/.test(lower)) return true
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower)) return true

  if (lower === '::1') return true
  if (lower.startsWith('fe80::')) return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true

  if (withDns) {
    // is it a public host that resolves to a private IP?
    try {
      const ips = await lookup(hostname, { all: true })
      for (const ip of ips) {
        if (await isPrivateHost({ hostname: ip.address, withDns: false })) {
          return true
        }
      }
    } catch {}
  }

  return false
}

export default async function handler (req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Cache-Control', 'no-store')
    res.status(405).end()
    return
  }

  // the request has to come only from us
  if (!fromUs(req)) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  let { url } = req.query

  if (typeof url !== 'string' || !/^(https?:\/\/)/.test(url)) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(400).json({ error: 'Invalid URL' })
    return
  }

  try {
    const u = new URL(url)
    // in development, the app container can't reach the public media url,
    // so we need to replace it with its docker equivalent, e.g. http://s3:4566/uploads
    if (u.origin === process.env.NEXT_PUBLIC_MEDIA_URL && process.env.NODE_ENV === 'development') {
      url = url.replace(process.env.NEXT_PUBLIC_MEDIA_URL, process.env.MEDIA_URL_DOCKER)
    }

    // don't allow private hosts
    if (process.env.NODE_ENV !== 'development' && await isPrivateHost({ hostname: u.hostname, withDns: true })) {
      res.setHeader('Cache-Control', 'no-store')
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const { mime, isImage, isVideo } = await tasteMediaUrl(url)

    res.setHeader('Vary', 'Origin, Referer, Sec-Fetch-Site')
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')

    res.status(200).json({ mime, isImage, isVideo })
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(500).json({ mime: null, isImage: false, isVideo: false })
  }
}
