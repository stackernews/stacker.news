import { nip19 } from 'nostr-tools'
import { DEFAULT_CROSSPOSTING_RELAYS } from './nostr'

export function ensureProtocol (value) {
  if (!value) return value
  value = value.trim()
  let url

  try {
    url = new URL(value)
  } catch {
    try {
      url = new URL('http://' + value)
    } catch {
      return value
    }
  }

  // remove trailing slash if new URL() added it
  if (url.href.endsWith('/') && !value.endsWith('/')) {
    return url.href.slice(0, -1)
  }
  return url.href
}

export function isExternal (url) {
  return !url.startsWith(process.env.NEXT_PUBLIC_URL + '/') && !url.startsWith('/')
}

export function removeTracking (value) {
  if (!value) return value
  const exprs = [
    // twitter URLs
    /^(?<url>https?:\/\/(?:twitter|x)\.com\/(?:#!\/)?(?<user>\w+)\/status(?:es)?\/(?<id>\d+))/
  ]
  for (const expr of exprs) {
    value = expr.exec(value)?.groups.url ?? value
  }
  return value
}

/**
 * parse links like https://stacker.news/items/123456 as #123456
 */

export function isItemPath (pathname) {
  if (!pathname) return false

  const [page, id] = pathname.split('/').filter(part => !!part)
  return page === 'items' && /^[0-9]+$/.test(id)
}

export function parseInternalLinks (href) {
  const url = new URL(href)
  const internalURL = process.env.NEXT_PUBLIC_URL
  const { pathname, searchParams } = url

  // ignore empty parts which exist due to pathname starting with '/'
  if (isItemPath(pathname) && url.origin === internalURL) {
    const parts = pathname.split('/').filter(part => !!part)
    const itemId = parts[1]
    // check for valid item page due to referral links like /items/123456/r/ekzyis
    const itemPages = ['edit', 'ots', 'related']
    const itemPage = itemPages.includes(parts[2]) ? parts[2] : null
    if (itemPage) {
      // parse   https://stacker.news/items/1/related?commentId=2
      // as      #1/related
      // and not #2
      // since commentId will be ignored anyway
      const linkText = `#${itemId}/${itemPage}`
      return { itemId, linkText }
    }
    const commentId = searchParams.get('commentId')
    const linkText = `#${commentId || itemId}`
    return { itemId, commentId, linkText }
  }

  return {}
}

export function parseEmbedUrl (href) {
  if (!href) return null

  try {
    const twitter = href.match(/^https?:\/\/(?:twitter|x)\.com\/(?:#!\/)?\w+\/status(?:es)?\/(?<id>\d+)/)
    if (twitter?.groups?.id) {
      return {
        provider: 'twitter',
        id: twitter.groups.id
      }
    }

    const { hostname, pathname, searchParams } = new URL(href)

    // nostr prefixes: [npub1, nevent1, nprofile1, note1]
    const nostr = href.match(/(?<id>(?<type>npub1|nevent1|nprofile1|note1|naddr1)[02-9ac-hj-np-z]+)/)
    if (nostr?.groups?.id) {
      let id = nostr.groups.id
      if (nostr.groups.type === 'npub1') {
        const { data } = nip19.decode(id)
        id = nip19.nprofileEncode({ pubkey: data })
      }
      if (nostr.groups.type === 'note1') {
        const { data } = nip19.decode(id)
        // njump needs relays to embed
        id = nip19.neventEncode({ id: data, relays: DEFAULT_CROSSPOSTING_RELAYS, author: '' })
      }
      return {
        provider: 'nostr',
        id
      }
    }

    // https://wavlake.com/track/c0aaeff8-5a26-49cf-8dad-2b6909e4aed1
    if (hostname.endsWith('wavlake.com') && pathname.startsWith('/track')) {
      return {
        provider: 'wavlake',
        id: pathname.split('/')?.[2]
      }
    }

    if (hostname.endsWith('spotify.com') && pathname.startsWith('/track')) {
      return {
        provider: 'spotify'
      }
    }

    if (hostname.endsWith('youtube.com')) {
      if (pathname.includes('/watch')) {
        return {
          provider: 'youtube',
          id: searchParams.get('v'),
          meta: {
            href,
            start: searchParams.get('t')
          }
        }
      }

      if (pathname.includes('/shorts')) {
        const id = pathname.split('/').slice(-1).join()
        return {
          provider: 'youtube',
          id
        }
      }
    }

    if (hostname.endsWith('youtu.be') && pathname.length > 1) {
      return {
        provider: 'youtube',
        id: pathname.slice(1), // remove leading slash
        meta: {
          href,
          start: searchParams.get('t')
        }
      }
    }

    if (hostname.endsWith('rumble.com') && pathname.includes('/embed')) {
      return {
        provider: 'rumble',
        id: null, // not required
        meta: {
          href
        }
      }
    }

    if (hostname.endsWith('peertube.tv') || hostname.endsWith('bitcointv.com')) {
      return {
        provider: 'peertube',
        id: null,
        meta: {
          href: href.replace('/w/', '/videos/embed/')
        }
      }
    }
  } catch (err) {
    console.error('Error parsing embed URL:', err)
  }

  return null
}

export function stripTrailingSlash (uri) {
  return uri.endsWith('/') ? uri.slice(0, -1) : uri
}

export function parseNwcUrl (walletConnectUrl) {
  if (!walletConnectUrl) return {}

  walletConnectUrl = walletConnectUrl
    .replace('nostrwalletconnect://', 'http://')
    .replace('nostr+walletconnect://', 'http://') // makes it possible to parse with URL in the different environments (browser/node/...)

  // XXX There is a bug in parsing since we use the URL constructor for parsing:
  // A wallet pubkey matching /^[0-9a-fA-F]{64}$/ might not be a valid hostname.
  // Example: 11111111111 (10 1's) is a valid hostname (gets parsed as IPv4) but 111111111111 (11 1's) is not.
  // See https://stackoverflow.com/questions/56804936/how-does-only-numbers-in-url-resolve-to-a-domain
  // However, this seems to only get triggered if a wallet pubkey only contains digits so this is pretty improbable.
  const url = new URL(walletConnectUrl)
  const params = {}
  params.walletPubkey = url.host
  const secret = url.searchParams.get('secret')
  const relayUrl = url.searchParams.get('relay')
  if (secret) {
    params.secret = secret
  }
  if (relayUrl) {
    params.relayUrl = relayUrl
  }
  return params
}

export function decodeProxyUrl (imgproxyUrl) {
  const parts = imgproxyUrl.split('/')
  // base64url is not a known encoding in browsers
  // so we need to replace the invalid chars
  const b64Url = parts[parts.length - 1].replace(/-/g, '+').replace(/_/, '/')
  const originalUrl = Buffer.from(b64Url, 'base64').toString('utf-8')
  return originalUrl
}

// eslint-disable-next-line
export const URL_REGEXP = /^((https?|ftp):\/\/)?(www.)?(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i

// eslint-disable-next-line
export const WS_REGEXP = /^(wss?:\/\/)([0-9]{1,3}(?:\.[0-9]{1,3}){3}|(?=[^\/]{1,254}(?![^\/]))(?:(?=[a-zA-Z0-9-]{1,63}\.)(?:xn--+)?[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*\.)+[a-zA-Z]{2,63})(:([0-9]{1,5}))?(\/[^\s`@#$^&=.?"{}\\]+\/?)*([^\s`@#$^&=?"{}\/\\]+)?(\?[^\s`#$^"{}\\]+)*$/

export const IMGPROXY_URL_REGEXP = new RegExp(`^${process.env.NEXT_PUBLIC_IMGPROXY_URL}.*$`)
export const MEDIA_DOMAIN_REGEXP = new RegExp(`^https?://${process.env.NEXT_PUBLIC_MEDIA_DOMAIN}/.*$`)

// this regex is not a bullet proof way of checking if a url points to an image. to be sure, fetch the url and check the mimetype
export const IMG_URL_REGEXP = /^(https?:\/\/.*\.(?:png|jpg|jpeg|gif))$/

export const TOR_REGEXP = /\.onion(:[0-9]+)?$/
