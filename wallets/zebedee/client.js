import { API_URL, PREIMAGE_AWAIT_TIMEOUT_MS } from '@/wallets/zebedee'
import { assertContentTypeJson } from '@/lib/url'
import { callWithTimeout } from '@/lib/time'
import { fetchWithTimeout } from '@/lib/fetch'

export * from '@/wallets/zebedee'

export async function testSendPayment ({ apiKey }, { signal }) {
  const wallet = await apiCall('wallet', { apiKey, method: 'GET' }, { signal })
  if (!wallet.data) throw new Error('wallet not found')
}

export async function sendPayment (bolt11, { apiKey }, { signal }) {
  const res = await apiCall('payments', { body: { invoice: bolt11 }, apiKey }, { signal })
  const { id, preimage } = res?.data
  if (preimage) return preimage
  // the api might return before the invoice is paid, so we'll wait for the preimage
  return await waitForPreimage(id, { apiKey }, { signal })
}

async function waitForPreimage (id, { apiKey }, { signal }) {
  return await callWithTimeout(async () => {
    let preimage
    while (true) {
      const res = await apiCall('payments/{id}', { body: { id }, apiKey, method: 'GET' }, { signal })
      preimage = res?.data?.preimage
      if (preimage) break
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    return preimage
  }, PREIMAGE_AWAIT_TIMEOUT_MS)
}

export async function apiCall (api, { body, apiKey, method = 'POST' }, { signal }) {
  const headers = {
    apikey: apiKey,
    'Content-Type': 'application/json'
  }
  if (method === 'GET' && body) {
    for (const [k, v] of Object.entries(body)) {
      api = api.replace('{' + k + '}', v)
    }
  }
  const res = await fetchWithTimeout(API_URL + api, {
    method,
    headers,
    signal,
    body: method === 'POST' ? JSON.stringify(body) : undefined
  })
  // https://zbd.dev/api-reference/errors
  if (res.status !== 200) {
    let error
    try {
      assertContentTypeJson(res)
      const json = await res.json()
      if (json?.message) error = json.message
    } catch (e) {
      error = res.statusText || 'error ' + res.status
    }
    throw new Error(error)
  }
  return res.json()
}
