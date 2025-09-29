import init, { defaultConfig, connect } from '@breeztech/breez-sdk-spark'
import { getUsername } from '@/wallets/lib/protocols/spark'

export const name = 'SPARK'

async function withSdk (mnemonic, cb) {
  await init()

  const config = defaultConfig('mainnet')
  // this API key should be kept a secret on a best effort basis
  config.apiKey = process.env.NEXT_PUBLIC_BREEZ_SDK_API_KEY
  config.lnurlDomain = 'breez.tips'

  const sdk = await connect({
    config,
    seed: { type: 'mnemonic', mnemonic, passphrase: undefined },
    // the SDK will create a IndexedDB with this name to store data
    storageDir: 'breez-sdk-spark'
  })

  const result = await cb(sdk)

  sdk.disconnect()

  return result
}

export async function sendPayment (bolt11, { mnemonic }, { signal }) {
  return await withSdk(
    mnemonic,
    async sdk => {
      const prepareResponse = await sdk.prepareSendPayment({
        paymentRequest: bolt11
      })

      const sendResponse = await sdk.sendPayment({
        prepareResponse,
        options: { type: 'bolt11Invoice', preferSpark: false }
      })

      return sendResponse.payment
    }
  )
}

export async function testSendPayment ({ mnemonic }, { signal }) {
  return await withSdk(
    mnemonic,
    async sdk => {
      const { paymentRequest: sparkAddress } = await sdk.receivePayment({
        // this will always return the same spark address for the same seed
        paymentMethod: { type: 'sparkAddress' }
      })

      const username = getUsername(sparkAddress)

      const available = await sdk.checkLightningAddressAvailable({ username })
      if (available) {
        await sdk.registerLightningAddress({ username, description: 'Running Spark SDK' })
      }

      return { username }
    }
  )
}
