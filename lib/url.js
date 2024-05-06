export function ensureProtocol (value) {
  if (!value) return value
  value = value.trim()
  if (!/^([a-z0-9]+:\/\/|mailto:)/.test(value)) {
    value = 'http://' + value
  }
  return value
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
export function parseInternalLinks (href) {
  const url = new URL(href)
  const internalURL = process.env.NEXT_PUBLIC_URL
  const { pathname, searchParams } = url
  // ignore empty parts which exist due to pathname starting with '/'
  const emptyPart = part => !!part
  const parts = pathname.split('/').filter(emptyPart)
  if (parts[0] === 'items' && /^[0-9]+$/.test(parts[1]) && url.origin === internalURL) {
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
      return linkText
    }
    const commentId = searchParams.get('commentId')
    const linkText = `#${commentId || itemId}`
    return linkText
  }
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

// eslint-disable-next-line
export const URL_REGEXP = /^((https?|ftp):\/\/)?(www.)?(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i

// eslint-disable-next-line
export const WS_REGEXP = /^(wss?:\/\/)([0-9]{1,3}(?:\.[0-9]{1,3}){3}|(?=[^\/]{1,254}(?![^\/]))(?:(?=[a-zA-Z0-9-]{1,63}\.)(?:xn--+)?[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*\.)+[a-zA-Z]{2,63})(:([0-9]{1,5}))?(\/[^\s`@#$^&=.?"{}\\]+\/?)*([^\s`@#$^&=?"{}\/\\]+)?(\?[^\s`#$^"{}\\]+)*$/

export const IMGPROXY_URL_REGEXP = new RegExp(`^${process.env.NEXT_PUBLIC_IMGPROXY_URL}.*$`)
export const MEDIA_DOMAIN_REGEXP = new RegExp(`^https?://${process.env.NEXT_PUBLIC_MEDIA_DOMAIN}/.*$`)

// this regex is not a bullet proof way of checking if a url points to an image. to be sure, fetch the url and check the mimetype
export const IMG_URL_REGEXP = /^(https?:\/\/.*\.(?:png|jpg|jpeg|gif))$/
