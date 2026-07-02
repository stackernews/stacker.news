import Nostr from '@/lib/nostr'
import { NDKNWCWallet } from '@nostr-dev-kit/ndk-wallet'
import { nwcUrlValidator, parseNwcUrl } from '@/wallets/lib/validate'
import { msatsToSats } from '@/lib/format'
import { walletAmountToMsatsOrUndefined } from '@/wallets/lib/amount'
import { isAbortLike, raceAbort } from '@/lib/time'
import { WalletPermissionsError } from '@/wallets/client/errors'

// Some NWC services (notably Alby Hub) extend the NIP-47 `get_balance` response
// with a non-standard `max_amount` field that uses 2^64-1 (uint64 max) as the
// "no cap" sentinel. NIP-47 itself only specifies `{ balance }`:
// https://github.com/nostr-protocol/nips/blob/master/47.md#get_balance
// We treat 2^64-1 as "unknown/no limit" for any msat field we read.
const UINT64_MAX_MSATS = 18446744073709551615n
export const NWC_PAY_INVOICE_METHOD = 'pay_invoice'
export const NWC_LOOKUP_INVOICE_METHOD = 'lookup_invoice'
const NWC_GET_BALANCE_METHOD = 'get_balance'
// Alby Hub returns EXPIRED for every scoped method on an expired connection.
const NWC_ACCESS_DENIED_CODES = new Set(['UNAUTHORIZED', 'RESTRICTED', 'EXPIRED'])

// Nostr Wallet Connect (NIP-47)
// https://github.com/nostr-protocol/nips/blob/master/47.md

export default [
  {
    name: 'NWC',
    send: true,
    displayName: 'Nostr Wallet Connect',
    logName: 'NWC',
    fields: [
      {
        name: 'url',
        label: 'url',
        placeholder: 'nostr+walletconnect://',
        type: 'password',
        help: [
          'The connection must allow `pay_invoice` to send payments.',
          'Allow `lookup_invoice` too if you want Stacker News to recover proof/status after uncertain sends.',
          'Allow `get_balance` too if you want Stacker News to show this wallet balance.'
        ],
        required: true,
        // send wallet: relays are dialed by the user's browser, so private/LAN is allowed
        validate: nwcUrlValidator({ allowPrivate: true }),
        encrypt: true
      }
    ],
    relationName: 'walletSendNWC'
  },
  {
    name: 'NWC',
    send: false,
    displayName: 'Nostr Wallet Connect',
    logName: 'NWC',
    fields: [
      {
        name: 'url',
        label: 'url',
        placeholder: 'nostr+walletconnect://',
        type: 'password',
        help: [
          'The connection must allow `make_invoice`. Allow `lookup_invoice` too if you want Stacker News to verify receive status.',
          'It must NOT allow spending (`pay_invoice`, `pay_keysend`, `multi_pay_invoice`, `multi_pay_keysend`): this secret is stored on our server, so attach a receive-only connection.'
        ],
        required: true,
        validate: nwcUrlValidator()
      }
    ],
    relationName: 'walletRecvNWC'
  }
]

export async function nwcTryRun (fun, { url }, { signal }) {
  const nostr = new Nostr()
  try {
    const nwc = await getNwc(nostr, url)
    // race the NWC call against signal so caller-initiated aborts/timeouts
    // settle the await even if NDK never responds
    const res = await raceAbort(fun(nwc), signal)
    if (res?.error) throw nwcResponseError(res.error)
    return res
  } catch (e) {
    if (isAbortLike(e)) throw e
    if (e.error) throw nwcResponseError(e.error)
    throw e
  } finally {
    nostr.close()
  }
}

function nwcResponseError (error) {
  const message = error?.message || error?.code || String(error)
  if (NWC_ACCESS_DENIED_CODES.has(error?.code)) {
    return new WalletPermissionsError(message)
  }
  return Object.assign(new Error(message), { nwcError: error })
}

export async function getNwc (nostr, url) {
  const ndk = nostr.ndk
  const { walletPubkey, secret, relayUrls } = parseNwcUrl(url)
  return new NDKNWCWallet(ndk, {
    pubkey: walletPubkey,
    relayUrls,
    secret
  })
}

export async function supportedMethods (url, { signal }) {
  const result = await nwcTryRun(nwc => nwc.getInfo(), { url }, { signal })
  return nwcSupportedMethods(result)
}

export async function getBalance (url, { signal } = {}) {
  return await nwcTryRun(async nwc => {
    const methods = nwcSupportedMethods(await nwc.getInfo())
    if (!methods.includes(NWC_GET_BALANCE_METHOD)) return null

    const response = await nwc.req('get_balance', {})
    if (response.error) {
      throw nwcResponseError(response.error)
    }

    const balance = response.result?.balance
    if (balance == null) return null

    const balanceSats = nwcMsatsToSats(balance)
    if (balanceSats == null) return null

    const maxAmount = response.result?.max_amount ?? response.result?.maxAmount
    if (maxAmount != null) {
      const maxAmountSats = nwcMsatsToSats(maxAmount)
      if (maxAmountSats != null) return Math.min(balanceSats, maxAmountSats)
    }

    return balanceSats
  }, { url }, { signal })
}

function nwcMsatsToSats (msats) {
  const amount = walletAmountToMsatsOrUndefined(msats)
  if (amount == null || amount === UINT64_MAX_MSATS) return null
  return msatsToSats(amount)
}

function nwcSupportedMethods (info) {
  if (Array.isArray(info?.methods)) return info.methods
  if (typeof info?.methods === 'string') return info.methods.split(/\s+/).filter(Boolean)
  return []
}
