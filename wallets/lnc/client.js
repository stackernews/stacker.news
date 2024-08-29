import { InvoiceCanceledError, InvoiceExpiredError } from '@/components/payment'
import { bolt11Tags } from '@/lib/bolt11'
import { Mutex } from 'async-mutex'
import { LncCredentialStore, checkPerms } from 'wallets/lnc'

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
        }, 50)
      })
    } catch (err) {
      logger.error('failed to disconnect from lnc', err)
    }
  }
}

export async function testSendPayment (credentials, { logger }) {
  let lnc
  try {
    lnc = await getLNC(credentials)

    logger.info('connecting ...')
    await lnc.connect()
    logger.ok('connected')

    logger.info('validating permissions ...')
    checkPerms(lnc, { canSend: true })
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
