import init, { defaultConfig, connect } from '@breeztech/breez-sdk-spark'
import { withTimeout } from '@/lib/time'
import { getUsername } from '@/wallets/lib/protocols/breezSpark'

export const name = 'BREEZ_SPARK'

const SDK_SYNC_TIMEOUT_MS = 30_000

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

  try {
    await waitForSync(sdk)
    return await cb(sdk)
  } finally {
    sdk.disconnect()
  }
}

async function waitForSync (sdk) {
  const syncPromise = new Promise(
    resolve => sdk.addEventListener(new SyncEventListener(resolve))
  )
  await withTimeout(syncPromise, SDK_SYNC_TIMEOUT_MS)
}

class SdkEventListener {
  constructor (event, resolve) {
    this.event = event
    this.resolve = resolve
  }

  onEvent (event) {
    if (event.type === this.event) {
      this.resolve()
    }
  }
}

class SyncEventListener extends SdkEventListener {
  constructor (resolve) {
    super('synced', resolve)
  }
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
