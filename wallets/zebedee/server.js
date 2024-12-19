import { GAMER_TAG_LNADDR_BASEURL, STATIC_CHARGE_URL, ZEBEDEE_LNDOMAIN } from '@/wallets/zebedee'
import { fetchWithTimeout } from '@/lib/fetch'
import { assertContentTypeJson } from '@/lib/url'

export * from '@/wallets/zebedee'

async function fetchJson (url, { signal }) {
  let res = await fetchWithTimeout(url, { signal })
  assertContentTypeJson(res)
  if (!res.ok) {
    res.text().catch(() => {})
    throw new Error(res.statusText || 'error ' + res.status)
  }
  res = await res.json()
  if (res.status?.toLowerCase() === 'error') {
    throw new Error(res.reason)
  }
  return res
}

function isGamerTag (value) {
  if (value.endsWith('@' + ZEBEDEE_LNDOMAIN)) return true
  return value.length > 0 && value.length < 30
}

export async function fetchGamerId (value, { signal }) {
  if (isGamerTag(value)) {
    const [gamerTag, domain] = value.split('@')
    if (domain && domain !== ZEBEDEE_LNDOMAIN) throw new Error(`invalid gamer tag: not a @${ZEBEDEE_LNDOMAIN} lightning address`)
    const url = GAMER_TAG_LNADDR_BASEURL + gamerTag
    try {
      const res = await fetchJson(url, { signal })
      const callback = res.callback
      if (!callback) throw new Error('cannot fetch gamer id: ' + (res.statusText || 'error ' + res.status))
      const gamerId = callback.substring(callback.lastIndexOf('/') + 1)
      return gamerId
    } catch (e) {
      throw new Error('cannot fetch gamer id: ' + e.message)
    }
  }
  return value
}

export async function testCreateInvoice (credentials, { signal }) {
  credentials.gamerTagId = await fetchGamerId(credentials.gamerTagId, { signal })
  return await createInvoice({ msats: 1000, expiry: 1 }, credentials, { signal })
}

export async function createInvoice ({ msats, description, expiry }, { gamerTagId }, { signal }) {
  try {
    const url = STATIC_CHARGE_URL + gamerTagId + '?amount=' + msats + '&comment=' + description
    const res = await fetchJson(url, { signal })
    if (!res.pr) throw new Error('cannot fetch invoice')
    return res.pr
  } catch (e) {
    throw new Error(e.message)
  }
}
