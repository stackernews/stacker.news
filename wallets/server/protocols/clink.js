import { msatsToSats } from '@/lib/format'
import { ClinkSDK, decodeBech32, generateSecretKey } from '@shocknet/clink-sdk'

export const name = 'CLINK'

export async function createInvoice (
  { msats, description, expiry },
  { noffer },
  { signal }) {
  const { data: { offer, relay, pubkey } } = decodeBech32(noffer)

  const sdk = new ClinkSDK({
    privateKey: generateSecretKey(),
    relays: [relay],
    toPubKey: pubkey
  })

  const request = { offer, amount_sats: msatsToSats(msats) }
  return await new Promise((resolve, reject) => {
    // TODO(clink): for some reason this throws 'Invalid Amount' but amount_sats is a number
    sdk.Noffer(request)
      .then(response => {
        if ('bolt11' in response) {
          return resolve(response.bolt11)
        }
        reject(new Error(response.error))
      })
  })
}

export async function testCreateInvoice ({ noffer }, { signal }) {
  return await createInvoice(
    { msats: 1000, description: 'SN test invoice', expiry: 1 },
    { noffer },
    { signal })
}
