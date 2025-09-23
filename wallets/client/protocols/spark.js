import init, { defaultConfig, connect } from '@breeztech/breez-sdk-spark'

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

  sdk.disconnect()
}
