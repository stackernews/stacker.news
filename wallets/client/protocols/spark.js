import { withSparkWallet } from '@/wallets/lib/protocols/spark'
import { sleep } from '@/lib/time'

export const name = 'SPARK'

const SPARK_PAYMENT_STATUS_POLL_INTERVAL_MS = 250

export async function sendPayment (bolt11, { mnemonic }, { signal }) {
  return await withSparkWallet(
    mnemonic,
    async wallet => {
      // this can throw immediately, for example if invoice is from a different network
      // or the wallet does have insufficient funds
      const payment = await wallet.payLightningInvoice({ invoice: bolt11 })

      // payments are async, we need to poll for status
      while (!signal.aborted) {
        const sendRequest = await wallet.getLightningSendRequest(payment.id)
        if (sendRequest.paymentPreimage) {
          return sendRequest.paymentPreimage
        }
        switch (sendRequest.status) {
          case 'LIGHTNING_PAYMENT_FAILED':
            // requests don't seem to include an error message:
            // https://github.com/buildonspark/spark/blob/66f1cef206920745cec5df3b1e5339337fcf4b71/sdks/js/packages/spark-sdk/src/graphql/objects/LightningSendRequest.ts#L12-L48
            throw new Error('Spark lightning send request failed')
          case 'LIGHTNING_PAYMENT_PENDING':
          default:
            await sleep(SPARK_PAYMENT_STATUS_POLL_INTERVAL_MS)
        }
      }
    }
  )
}

export async function testSendPayment ({ mnemonic }, { signal }) {
  const identityPublicKey = await withSparkWallet(
    mnemonic,
    wallet => wallet.getIdentityPublicKey()
  )
  return { identityPublicKey }
}
