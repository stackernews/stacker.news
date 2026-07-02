import bip39Words from '@/lib/bip39-words'
import { decodeRune } from '@/lib/cln'
import { B64_URL_REGEX } from '@/lib/format'
import { isInvoicableMacaroon, isInvoiceMacaroon } from '@/lib/macaroon'
import { NOSTR_PUBKEY_HEX } from '@/lib/nostr'
import { TOR_REGEXP } from '@/lib/url'
import { lightningAddressValidator } from '@/lib/validate'
import { decodeBech32 as clinkDecodeBech32, OfferPriceType } from '@shocknet/clink-sdk'
import { string, array } from '@/lib/yup'

export const externalLightningAddressValidator = lightningAddressValidator
  .test({
    name: 'address',
    test: addr => !addr.toLowerCase().endsWith('@stacker.news'),
    message: 'lightning address must be external'
  })

export const nwcUrlValidator = ({ allowPrivate = false } = {}) =>
  string()
    .url()
    .test({
      test: (url, context) => {
        if (!url) return true

        // run validation in sequence to control order of errors
        // inspired by https://github.com/jquense/yup/issues/851#issuecomment-1049705180
        try {
          string().matches(/^nostr\+?walletconnect:\/\//, { message: 'must start with nostr+walletconnect://' }).validateSync(url)
          let relayUrls, walletPubkey, secret
          try {
            ({ relayUrls, walletPubkey, secret } = parseNwcUrl(url))
          } catch {
            // invalid URL error. handle as if pubkey validation failed to not confuse user.
            throw new Error('pubkey must be 64 hex chars')
          }
          string().required('pubkey required').trim().matches(NOSTR_PUBKEY_HEX, 'pubkey must be 64 hex chars').validateSync(walletPubkey)
          // receive relays are dialed by our servers and must be public; send relays are
          // dialed by the user's browser (allowPrivate) and may reach their own LAN
          let relaySchema = string().required('relay url required').trim().wss('relay must use wss://')
          // .wss() runs first and guarantees a parseable wss:// url, so new URL won't throw here
          if (!allowPrivate) relaySchema = relaySchema.publicHost(relay => new URL(relay).hostname, 'relay must be a public address')
          array().of(relaySchema).min(1, 'at least one relay required').validateSync(relayUrls)
          string().required('secret required').trim().matches(/^[0-9a-fA-F]{64}$/, 'secret must be 64 hex chars').validateSync(secret)
        } catch (err) {
          return context.createError({ message: err.message })
        }
        return true
      }
    })

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
  return {
    walletPubkey: url.host,
    secret: url.searchParams.get('secret'),
    relayUrls: url.searchParams.getAll('relay'),
    lud16: url.searchParams.get('lud16')
  }
}

export const clinkValidator = (type, { allowPrivate = false } = {}) => {
  const schema = string()
    .matches(new RegExp(`^${type}1`), { message: `must start with ${type}1` })
    .matches(/^(noffer|ndebit)1[02-9ac-hj-np-z]+$/, { message: 'invalid bech32 encoding' })
    .test({
      name: 'decode',
      test: (v, context) => {
        let decoded
        try {
          decoded = clinkDecodeBech32(v)
        } catch (e) {
          return context.createError({ message: `failed to decode bech32: ${e.message}` })
        }

        if (decoded.type !== type) {
          return context.createError({ message: `must be ${type}` })
        }

        const { data } = decoded
        if (!data) return context.createError({ message: 'no data' })

        if (type === 'noffer' && data.priceType && data.priceType !== OfferPriceType.Spontaneous) {
          return context.createError({ message: 'offer must be for spontaneous payments' })
        }

        return true
      }
    })

  // the relay is decoded from the bech32 and dialed server-side for receive (noffer);
  // ndebit send is browser-dialed (allowPrivate) and may reach the user's own LAN
  if (allowPrivate) return schema
  return schema.publicHost(v => {
    const relay = clinkDecodeBech32(v).data?.relay
    if (!relay) return ''
    try {
      return new URL(relay).hostname
    } catch {
      return new URL(`wss://${relay}`).hostname
    }
  }, 'relay must be a public address')
}

export const socketValidator = ({ allowPrivate = false } = {}) => {
  const schema = string()
    .test({
      name: 'socket',
      message: 'invalid socket',
      test: value => {
        try {
          const url = new URL(`http://${value}`)
          return !!(url.hostname && url.port && !url.username && !url.password &&
              (!url.pathname || url.pathname === '/') && !url.search && !url.hash)
        } catch (e) {
          return false
        }
      },
      exclusive: false
    })

  // sockets we dial server-side (gRPC, CLN-REST receive) must be public — and since gRPC
  // bypasses snFetch, this is its only SSRF guard (IP literals only; a hostname resolving
  // private is not caught here). the browser-dialed send socket is exempt: it may
  // legitimately reach the user's own LAN.
  if (allowPrivate) return schema
  return schema.publicHost(value => new URL(`http://${value}`).hostname)
}

export const runeValidator = ({ method, methods, optionalMethods = [] }) => {
  const requiredAlternatives = (methods ?? [method]).map(method => `method=${method}`)
  const optionalAlternatives = optionalMethods.map(method => `method=${method}`)
  const allowedAlternatives = [...requiredAlternatives, ...optionalAlternatives]
  const expectedRestriction = requiredAlternatives.join(' or ') +
    (optionalAlternatives.length ? `, optionally ${optionalAlternatives.join(' or ')}` : '')

  return string()
    .matches(B64_URL_REGEX, { message: 'invalid rune' })
    .test({
      name: 'rune',
      test: (v, context) => {
        const decoded = decodeRune(v)
        if (!decoded) return context.createError({ message: 'invalid rune' })
        // Non-method restrictions harden the rune; do not reject them.
        const methodRestrictions = decoded.restrictions.filter(
          restriction => restriction.alternatives.some(alternative => alternative.startsWith('method'))
        )
        if (methodRestrictions.length === 0) {
          return context.createError({ message: `rune must be restricted to ${expectedRestriction}` })
        }
        if (methodRestrictions.length !== 1) {
          return context.createError({ message: `rune must have exactly one method restriction (${expectedRestriction})` })
        }

        const alternatives = new Set(methodRestrictions[0].alternatives)
        if (
          !requiredAlternatives.every(alternative => alternatives.has(alternative)) ||
          !methodRestrictions[0].alternatives.every(alternative => allowedAlternatives.includes(alternative))
        ) {
          return context.createError({ message: `rune must be restricted to ${expectedRestriction} only` })
        }
        return true
      }
    })
}

export const invoiceMacaroonValidator = () =>
  string()
    .hexOrBase64()
    .test({
      name: 'macaroon',
      test: v => isInvoiceMacaroon(v) || isInvoicableMacaroon(v),
      message: 'not an invoice macaroon or an invoicable macaroon'
    })

export const bip39Validator = ({ min = 12, max = 24 } = {}) =>
  string()
    .test({
      name: 'bip39',
      test: async (value, context) => {
        const words = value ? value.trim().split(/[\s]+/) : []
        for (const w of words) {
          try {
            await string().oneOf(bip39Words).validate(w)
          } catch {
            return context.createError({ message: `'${w}' is not a valid pairing phrase word` })
          }
        }
        if (words.length < min) {
          return context.createError({ message: `needs at least ${min} words` })
        }
        if (words.length > max) {
          return context.createError({ message: `max ${max} words` })
        }
        return true
      }
    })

export const certValidator = () => string().hexOrBase64()

export const urlValidator = (...args) => {
  // receive endpoints are dialed by our servers and must be public; send endpoints are
  // dialed by the user's browser, which may legitimately reach their own LAN/tailnet
  const { allowPrivate = false } = args.find(arg => arg && typeof arg === 'object' && !Array.isArray(arg)) ?? {}

  if (process.env.NODE_ENV === 'development') {
    return string()
      .or([
        string().matches(/^(http:\/\/)?localhost:\d+$/),
        string().url()
      ], 'invalid url')
      .trim()
  }

  const schema = string().url().trim()
    .test(async (url, context) => {
      if (args.includes('tor') && TOR_REGEXP.test(url)) {
        // allow HTTP and HTTPS over Tor
        if (!/^https?:\/\//.test(url)) {
          return context.createError({ message: 'http or https required' })
        }
        return true
      }

      if (args.includes('clearnet')) {
        try {
          // force HTTPS over clearnet
          await string().https().validate(url)
        } catch (err) {
          return context.createError({ message: err.message })
        }
      }

      return true
    })

  if (allowPrivate) return schema
  // reject private/internal IP-literal endpoints (hostnames are judged at fetch time).
  // mirror url()'s schemeless fallback so a schemeless private IP can't slip past.
  return schema.publicHost(url => {
    try {
      return new URL(url).hostname
    } catch {
      return new URL(`http://${url}`).hostname
    }
  })
}

export const hexValidator = (length) => string().hex().length(length, `must be exactly ${length} hex chars`)
