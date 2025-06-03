import Nostr from '@/lib/nostr'
import { NDKNWCWallet } from '@nostr-dev-kit/ndk-wallet'
import { parseNwcUrl } from '@/wallets/lib/validate'

export async function nwcTryRun (fun, { url }, { signal }) {
  const nostr = new Nostr()
  try {
    const nwc = await getNwc(nostr, url, { signal })
    return await fun(nwc)
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
