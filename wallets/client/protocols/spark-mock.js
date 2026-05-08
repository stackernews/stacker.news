// sndev-only: instead of calling the Spark SDK to actually pay, POST to the
// mock endpoint which pays the mirrored sn_lnd invoice via the stacker lnd.
// prepareConfig and testSendPayment stay real so wallet attach still exercises
// the SDK and validates the mnemonic against hosted Spark infrastructure.
export { prepareConfig, testSendPayment } from './spark'

export const name = 'SPARK'

export async function sendPayment (bolt11, _config, { signal } = {}) {
  const response = await fetch('/api/spark-mock/pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bolt11 }),
    signal
  })

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error || 'Spark mock payment failed')
  }
  if (!body?.preimage) {
    throw new Error('Spark mock payment did not return a preimage')
  }

  return body.preimage
}
