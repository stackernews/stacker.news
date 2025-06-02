import Nostr from '@/lib/nostr'
import { parseNwcUrl } from '@/wallets/lib/validate'
import { NDKNWCWallet } from '@nostr-dev-kit/ndk-wallet'

export const name = 'NWC'

export async function createInvoice ({ msats, description, expiry }, { url }, { signal }) {
  const result = await nwcTryRun(
    nwc => nwc.req('make_invoice', { amount: msats, description, expiry }),
    { url },
    { signal }
  )
  return result.result.invoice
}

export async function testCreateInvoice ({ url }, { signal }) {
  return await createInvoice(
    { msats: 1000, description: 'SN test invoice', expiry: 1 },
    { url },
    { signal }
  )
}

async function nwcTryRun (fun, { url }, { signal }) {
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

async function getNwc (nostr, nwcUrl, { signal }) {
  const ndk = nostr.ndk
  const { walletPubkey, secret, relayUrls } = parseNwcUrl(nwcUrl)
  const nwc = new NDKNWCWallet(ndk, {
    pubkey: walletPubkey,
    relayUrls,
    secret
  })
  return nwc
}
