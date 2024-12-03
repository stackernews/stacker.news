import { Mutex } from 'async-mutex'
export * from '@/wallets/lnc'

const mutex = new Mutex()
const serverHost = 'mailbox.terminal.lightning.today:443'

export async function testSendPayment (credentials, { logger }) {
  const lnc = await getLNC(credentials, { logger })
  logger?.info('validating permissions ...')
  await validateNarrowPerms(lnc)
  logger?.info('permissions ok')
  return lnc.credentials.credentials
}

export async function sendPayment (bolt11, credentials, { logger }) {
  return await mutex.runExclusive(async () => {
    const lnc = await getLNC(credentials, { logger })
    const { paymentError, paymentPreimage: preimage } = await lnc.lnd.lightning.sendPaymentSync({ payment_request: bolt11 })
    if (paymentError) throw new Error(paymentError)
    if (!preimage) throw new Error('No preimage in response')
    return preimage
  })
}

async function disconnectLNC (lnc, { logger } = {}) {
  try {
    if (!lnc?.isConnected) return
    lnc.disconnect()
    logger?.info('disconnecting...')
    // wait for lnc to disconnect
    await new Promise((resolve, reject) => {
      let counter = 0
      const interval = setInterval(() => {
        if (lnc?.isConnected) {
          if (counter++ > 100) {
            logger?.error('failed to disconnect from lnc')
            clearInterval(interval)
            reject(new Error('failed to disconnect from lnc'))
          }
          return
        }
        clearInterval(interval)
        resolve()
      })
    }, 50)
    logger?.info('disconnected')
  } catch (err) {
    logger?.error('failed to disconnect from lnc: ' + err)
  }
}

async function getLNC (credentials = {}, { logger } = {}) {
  if (window.snLncKillerTimeout) clearTimeout(window.snLncKillerTimeout)

  if (!window.snLnc) { // create new instance
    const { default: LNC } = await import('@lightninglabs/lnc-web')
    window.snLnc = new LNC({
      credentialStore: new LncCredentialStore({
        ...credentials,
        serverHost
      })
    })

    window.addEventListener('beforeunload', () => {
      // try to disconnect gracefully when the page is closed
      disconnectLNC(window.snLnc, { logger })
    })
  } else if (JSON.stringify(window.snLncCredentials ?? {}) !== JSON.stringify(credentials)) {
    console.log('LNC instance has new credentials')
    // disconnect and update credentials if they've changed
    await disconnectLNC(window.snLnc, { logger })
    // XXX we MUST reuse the same instance of LNC because it references a global Go object
    // that holds closures to the first LNC instance it's created with
    window.snLnc.credentials.credentials = {
      ...window.snLnc.credentials.credentials,
      ...credentials,
      serverHost
    }
  }

  if (!window.snLnc.isConnected) {
    logger?.info('connecting ...')
    await window.snLnc.connect()
    logger?.info('connected')
  }

  window.snLncCredentials = {
    ...credentials
  }

  window.snLncKillerTimeout = setTimeout(() => {
    logger?.info('disconnecting from lnc due to inactivity ...')
    mutex.runExclusive(async () => {
      await disconnectLNC(window.snLnc, { logger })
    })
  }, 4000)

  return window.snLnc
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
