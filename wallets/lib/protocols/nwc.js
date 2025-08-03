import Nostr from '@/lib/nostr'
import { NDKNWCWallet } from '@nostr-dev-kit/ndk-wallet'
import { nwcUrlValidator, parseNwcUrl } from '@/wallets/lib/validate'

// Nostr Wallet Connect (NIP-47)
// https://github.com/nostr-protocol/nips/blob/master/47.md

export default [
  {
    name: 'NWC',
    send: true,
    displayName: 'Nostr Wallet Connect',
    fields: [
      {
        name: 'url',
        label: 'url',
        placeholder: 'nostr+walletconnect://',
        type: 'password',
        required: true,
        validate: nwcUrlValidator(),
        encrypt: true
      }
    ],
    relationName: 'walletSendNWC'
  },
  {
    name: 'NWC',
    send: false,
    displayName: 'Nostr Wallet Connect',
    fields: [
      {
        name: 'url',
        label: 'url',
        placeholder: 'nostr+walletconnect://',
        type: 'password',
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
    const nwc = await getNwc(nostr, url, { signal })
    const res = await fun(nwc)
    if (res.error) throw new Error(res.error)
    return res
  } catch (e) {
    if (e.error) throw new Error(e.error.message || e.error.code)
    throw e
  } finally {
    nostr.close()
  }
}

export async function getNwc (nostr, url, { signal }) {
  const ndk = nostr.ndk
  const { walletPubkey, secret, relayUrls } = parseNwcUrl(url)
  const nwc = new NDKNWCWallet(ndk, {
    pubkey: walletPubkey,
    relayUrls,
    secret
  })
  return nwc
}

export async function supportedMethods (url, { signal }) {
  const result = await nwcTryRun(nwc => nwc.getInfo(), { url }, { signal })
  return result.methods
}
