import init, { defaultConfig, connect } from '@breeztech/breez-sdk-spark'
import { WalletValidationError } from '@/wallets/client/errors'
import { getUsername } from '@/wallets/lib/protocols/spark'

export const name = 'SPARK'

export async function sendPayment (bolt11, { mnemonic }, { signal }) {
  // TODO: implement
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

  await sdk.getInfo({})

  const { paymentRequest: sparkAddress } = await sdk.receivePayment({
    // this will always return the same spark address for the same seed
    paymentMethod: { type: 'sparkAddress' }
  })

  // check and register lightning address here so we can test it in the next step
  // https://sdk-doc-spark.breez.technology/guide/receive_lnurl_pay.html
  const username = getUsername(sparkAddress)
  const available = await sdk.checkLightningAddressAvailable({ username })
  if (!available) {
    // TODO: better error message for user? but this should never happen with randomly generated mnemonics, right?
    throw new WalletValidationError('lightning address unavailable')
  }
  await sdk.registerLightningAddress({ username, description: 'Running Spark SDK' })

  sdk.disconnect()

  return { username }
}
