import Nostr from '@/lib/nostr'
import { string } from '@/lib/yup'
import { parseNwcUrl } from '@/lib/url'
import { NDKNWCWallet } from '@nostr-dev-kit/ndk-wallet'

export const name = 'nwc'
export const walletType = 'NWC'
export const walletField = 'walletNWC'

export const fields = [
  {
    name: 'nwcUrl',
    label: 'connection',
    type: 'password',
    optional: 'for sending',
    clientOnly: true,
    requiredWithout: 'nwcUrlRecv',
    validate: string().nwcUrl()
  },
  {
    name: 'nwcUrlRecv',
    label: 'connection',
    type: 'password',
    optional: 'for receiving',
    serverOnly: true,
    requiredWithout: 'nwcUrl',
    validate: string().nwcUrl()
  }
]

export const card = {
  title: 'NWC',
  subtitle: 'use Nostr Wallet Connect for payments'
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

/**
 * Run a nwc function and throw if it errors
 * (workaround to handle ambiguous NDK error handling)
 * @param {function} fun - the nwc function to run
 * @returns - the result of the nwc function
 */
export async function nwcTryRun (fun, { nwcUrl }, { signal }) {
  const nostr = new Nostr()
  try {
    const nwc = await getNwc(nostr, nwcUrl, { signal })
    return await fun(nwc)
  } catch (e) {
    if (e.error) throw new Error(e.error.message || e.error.code)
    throw e
  } finally {
    nostr.close()
  }
}

export async function supportedMethods (nwcUrl, { signal }) {
  const result = await nwcTryRun(nwc => nwc.getInfo(), { nwcUrl }, { signal })
  return result.methods
}
