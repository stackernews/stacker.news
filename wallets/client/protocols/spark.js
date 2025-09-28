import init, { defaultConfig, connect } from '@breeztech/breez-sdk-spark'
import { getUsername } from '@/wallets/lib/protocols/spark'

export const name = 'SPARK'

export async function sendPayment (bolt11, { mnemonic }, { signal }) {
  // TODO(spark): implement
}

export async function testSendPayment ({ mnemonic }, { signal }) {
  await init()

  const config = defaultConfig('mainnet')
  // this API key should be kept a secret on a best effort basis
  config.apiKey = process.env.NEXT_PUBLIC_BREEZ_SDK_API_KEY
  config.lnurlDomain = 'breez.tips'

  const sdk = await connect({
    config,
    mnemonic,
    // the SDK will create a IndexedDB with this name to store data
    storageDir: 'breez-sdk-spark'
  })

  const { paymentRequest: sparkAddress } = await sdk.receivePayment({
    // this will always return the same spark address for the same seed
    paymentMethod: { type: 'sparkAddress' }
  })

  // check and register lightning address here
  // if we haven't already so we can test it in the next step
  // https://sdk-doc-spark.breez.technology/guide/receive_lnurl_pay.html
  const username = getUsername(sparkAddress)

  const available = await sdk.checkLightningAddressAvailable({ username })
  if (available) {
    await sdk.registerLightningAddress({ username, description: 'Running Spark SDK' })
  }

  sdk.disconnect()

  return { username }
}
