import Nostr from '@/lib/nostr'
import { string } from '@/lib/yup'
import { parseNwcUrl } from '@/lib/url'
import { NDKNwc } from '@nostr-dev-kit/ndk'

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

export async function getNwc (nwcUrl, { timeout = 5e4 } = {}) {
  const ndk = Nostr.ndk
  const { walletPubkey, secret, relayUrls } = parseNwcUrl(nwcUrl)
  const nwc = new NDKNwc({
    ndk,
    pubkey: walletPubkey,
    relayUrls,
    secret
  })
  await nwc.blockUntilReady(timeout)
  return nwc
}

/**
 * Run a nwc function and throw if it errors
 * (workaround to handle ambiguous NDK error handling)
 * @param {function} fun - the nwc function to run
 * @returns - the result of the nwc function
 */
export async function nwcTryRun (fun) {
  try {
    const { error, result } = await fun()
    if (error) throw new Error(error.message || error.code)
    return result
  } catch (e) {
    if (e.error) throw new Error(e.error.message || e.error.code)
    throw e
  }
}

export async function supportedMethods (nwcUrl, { timeout } = {}) {
  const nwc = await getNwc(nwcUrl, { timeout })
  const result = await nwcTryRun(() => nwc.getInfo())
  return result.methods
}
