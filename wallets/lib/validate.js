import bip39Words from '@/lib/bip39-words'
import { decodeRune } from '@/lib/cln'
import { B64_URL_REGEX } from '@/lib/format'
import { isInvoicableMacaroon, isInvoiceMacaroon } from '@/lib/macaroon'
import { NOSTR_PUBKEY_HEX } from '@/lib/nostr'
import { TOR_REGEXP } from '@/lib/url'
import { lightningAddressValidator } from '@/lib/validate'
import { string, array } from 'yup'

export const externalLightningAddressValidator = () =>
  lightningAddressValidator
    .test({
      name: 'address',
      test: addr => !addr.toLowerCase().endsWith('@stacker.news'),
      message: 'lightning address must be external'
    })

export const nwcUrlValidator = () =>
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
          array().of(
            string().required('relay url required').trim().wss('relay must use wss://')
          ).min(1, 'at least one relay required').validateSync(relayUrls)
          string().required('secret required').trim().matches(/^[0-9a-fA-F]{64}$/, 'secret must be 64 hex chars').validateSync(secret)
        } catch (err) {
          return context.createError({ message: err.message })
        }
        return true
      }
    })

function parseNwcUrl (walletConnectUrl) {
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
  const relayUrls = url.searchParams.getAll('relay')
  if (secret) {
    params.secret = secret
  }
  if (relayUrls) {
    params.relayUrls = relayUrls
  }
  return params
}

export const socketValidator = (msg = 'invalid socket') =>
  string()
    .test({
      name: 'socket',
      message: msg,
      test: value => {
        try {
          const url = new URL(`http://${value}`)
          return url.hostname && url.port && !url.username && !url.password &&
              (!url.pathname || url.pathname === '/') && !url.search && !url.hash
        } catch (e) {
          return false
        }
      },
      exclusive: false
    })

export const runeValidator = ({ method }) =>
  string()
    .matches(B64_URL_REGEX, { message: 'invalid rune' })
    .test({
      name: 'rune',
      test: (v, context) => {
        const decoded = decodeRune(v)
        if (!decoded) return context.createError({ message: 'invalid rune' })
        if (decoded.restrictions.length === 0) {
          return context.createError({ message: `rune must be restricted to method=${method}` })
        }
        if (decoded.restrictions.length !== 1 || decoded.restrictions[0].alternatives.length !== 1) {
          return context.createError({ message: `rune must be restricted to method=${method} only` })
        }
        if (decoded.restrictions[0].alternatives[0] !== `method=${method}`) {
          return context.createError({ message: `rune must be restricted to method=${method} only` })
        }
        return true
      }
    })

export const invoiceMacaroonValidator = () =>
  string()
    .hexOrBase64()
    .test({
      name: 'macaroon',
      test: v => isInvoiceMacaroon(v) || isInvoicableMacaroon(v),
      message: 'not an invoice macaroon or an invoicable macaroon'
    })

export const bip39Validator = () =>
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
        if (words.length < 2) {
          return context.createError({ message: 'needs at least two words' })
        }
        if (words.length > 10) {
          return context.createError({ message: 'max 10 words' })
        }
        return true
      }
    })

export const certValidator = () => string().hexOrBase64()

export const urlValidator = (...args) =>
  process.env.NODE_ENV === 'development'
    ? string()
      .or([
        string().matches(/^(http:\/\/)?localhost:\d+$/),
        string().url()
      ], 'invalid url')
      .trim()
    : string().url().trim()
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

export const hexValidator = (length) => string().hex().length(length, `must be exactly ${length} hex chars`)
