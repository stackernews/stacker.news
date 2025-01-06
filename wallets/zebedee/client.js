import { API_URL } from '@/wallets/zebedee'
import { assertContentTypeJson } from '@/lib/url'
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
  while (!signal.aborted) {
    const res = await apiCall('payments/{id}', { body: { id }, apiKey, method: 'GET' }, { signal })

    // return preimage if it's available
    const preimage = res?.data?.preimage
    if (preimage) return preimage

    // wait a before checking again
    await new Promise(resolve => setTimeout(resolve, 30))
  }
  return null
}

export async function apiCall (api, { body, apiKey, method = 'POST' }, { signal }) {
  // if get request, put params into the url
  if (method === 'GET' && body) {
    for (const [k, v] of Object.entries(body)) {
      api = api.replace(`{${k}}`, v)
    }
  }

  const res = await fetch(API_URL + api, {
    method,
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json'
    },
    signal,
    body: method === 'POST' ? JSON.stringify(body) : undefined
  })

  // Catch errors
  //   ref: https://zbd.dev/api-reference/errors
  if (res.status < 200 || res.status > 299) {
    // try to extract the error message from the response
    let error
    try {
      assertContentTypeJson(res)
      const json = await res.json()
      if (json?.message) error = json.message
    } catch (e) {
      console.log('failed to parse error', e)
    }
    // throw the error, if we don't have one, we try to use the request status
    throw new Error(error ?? (res.statusText || `error ${res.status}`))
  }

  assertContentTypeJson(res)
  return await res.json()
}
