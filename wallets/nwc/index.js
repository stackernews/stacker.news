import Nostr from '@/lib/nostr'
import { string } from '@/lib/yup'
import { parseNwcUrl } from '@/lib/url'
import { NDKNwc } from '@nostr-dev-kit/ndk'
import { TimeoutError } from '@/lib/time'

const NWC_CONNECT_TIMEOUT_MS = 15_000

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
  const nwc = new NDKNwc({
    ndk,
    pubkey: walletPubkey,
    relayUrls,
    secret
  })

  // TODO: support AbortSignal
  try {
    await nwc.blockUntilReady(NWC_CONNECT_TIMEOUT_MS)
  } catch (err) {
    if (err.message === 'Timeout') {
      throw new TimeoutError(NWC_CONNECT_TIMEOUT_MS)
    }
    throw err
  }

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
    const { error, result } = await fun(nwc)
    if (error) throw new Error(error.message || error.code)
    return result
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
