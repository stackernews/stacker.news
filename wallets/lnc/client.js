import { InvoiceCanceledError, InvoiceExpiredError } from '@/components/payment'
import { bolt11Tags } from '@/lib/bolt11'
import { Mutex } from 'async-mutex'
export * from 'wallets/lnc'

async function disconnect (lnc, logger) {
  if (lnc) {
    try {
      lnc.disconnect()
      logger.info('disconnecting...')
      // wait for lnc to disconnect before releasing the mutex
      await new Promise((resolve, reject) => {
        let counter = 0
        const interval = setInterval(() => {
          if (lnc?.isConnected) {
            if (counter++ > 100) {
              logger.error('failed to disconnect from lnc')
              clearInterval(interval)
              reject(new Error('failed to disconnect from lnc'))
            }
            return
          }
          clearInterval(interval)
          resolve()
        })
      }, 50)
    } catch (err) {
      logger.error('failed to disconnect from lnc', err)
    }
  }
}

export async function testConnectClient (credentials, { logger }) {
  let lnc
  try {
    lnc = await getLNC(credentials)

    logger.info('connecting ...')
    await lnc.connect()
    logger.ok('connected')

    logger.info('validating permissions ...')
    await validateNarrowPerms(lnc)
    logger.ok('permissions ok')

    return lnc.credentials.credentials
  } finally {
    await disconnect(lnc, logger)
  }
}

const mutex = new Mutex()

export async function sendPayment (bolt11, credentials, { logger }) {
  const hash = bolt11Tags(bolt11).payment_hash

  return await mutex.runExclusive(async () => {
    let lnc
    try {
      lnc = await getLNC(credentials)

      await lnc.connect()
      const { paymentError, paymentPreimage: preimage } =
          await lnc.lnd.lightning.sendPaymentSync({ payment_request: bolt11 })

      if (paymentError) throw new Error(paymentError)
      if (!preimage) throw new Error('No preimage in response')

      return { preimage }
    } catch (err) {
      const msg = err.message || err.toString?.()
      if (msg.includes('invoice expired')) {
        throw new InvoiceExpiredError(hash)
      }
      if (msg.includes('canceled')) {
        throw new InvoiceCanceledError(hash)
      }
      throw err
    } finally {
      await disconnect(lnc, logger)
    }
  })
}

async function getLNC (credentials = {}) {
  const { default: { default: LNC } } = await import('@lightninglabs/lnc-web')
  return new LNC({
    credentialStore: new LncCredentialStore({ ...credentials, serverHost: 'mailbox.terminal.lightning.today:443' })
  })
}

function validateNarrowPerms (lnc) {
  if (!lnc.hasPerms('lnrpc.Lightning.SendPaymentSync')) {
    throw new Error('missing permission: lnrpc.Lightning.SendPaymentSync')
  }
  if (lnc.hasPerms('lnrpc.Lightning.SendCoins')) {
    throw new Error('too broad permission: lnrpc.Wallet.SendCoins')
  }
  // TODO: need to check for more narrow permissions
  // blocked by https://github.com/lightninglabs/lnc-web/issues/112
}

// default credential store can go fuck itself
class LncCredentialStore {
  credentials = {
    localKey: '',
    remoteKey: '',
    pairingPhrase: '',
    serverHost: ''
  }

  constructor (credentials = {}) {
    this.credentials = { ...this.credentials, ...credentials }
  }

  get password () {
    return ''
  }

  set password (password) { }

  get serverHost () {
    return this.credentials.serverHost
  }

  set serverHost (host) {
    this.credentials.serverHost = host
  }

  get pairingPhrase () {
    return this.credentials.pairingPhrase
  }

  set pairingPhrase (phrase) {
    this.credentials.pairingPhrase = phrase
  }

  get localKey () {
    return this.credentials.localKey
  }

  set localKey (key) {
    this.credentials.localKey = key
  }

  get remoteKey () {
    return this.credentials.remoteKey
  }

  set remoteKey (key) {
    this.credentials.remoteKey = key
  }

  get isPaired () {
    return !!this.credentials.remoteKey || !!this.credentials.pairingPhrase
  }

  clear () {
    this.credentials = {}
  }
}
