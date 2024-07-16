import CancelButton from '@/components/cancel-button'
import { Form, PasswordInput, SubmitButton } from '@/components/form'
import { InvoiceCanceledError, InvoiceExpiredError } from '@/components/payment'
import { bolt11Tags } from '@/lib/bolt11'
import LNC from '@lightninglabs/lnc-web'
import { Mutex } from 'async-mutex'
import { Status } from 'wallets'

const XXX_DEFAULT_PASSWORD = 'password'

export async function validate ({ pairingPhrase, password }, { me, logger }) {
  const lnc = await getLNC({ me })
  try {
    lnc.credentials.pairingPhrase = pairingPhrase
    logger.info('connecting ...')
    await lnc.connect()
    logger.ok('connected')
    logger.info('validating permissions ...')
    await validateNarrowPerms(lnc)
    logger.ok('permissions ok')
    lnc.credentials.password = password || XXX_DEFAULT_PASSWORD
  } finally {
    lnc.disconnect()
  }
}

const mutex = new Mutex()

async function unlock ({ password }, { lnc, status, showModal, logger }) {
  if (status === Status.Enabled) return password

  return await new Promise((resolve, reject) => {
    const cancelAndReject = async () => {
      reject(new Error('password canceled'))
    }
    showModal(onClose => {
      return (
        <Form
          initial={{
            password: ''
          }}
          onSubmit={async (values) => {
            try {
              lnc.credentials.password = values?.password
              logger.ok('wallet unlocked')
              onClose()
              resolve(values.password)
            } catch (err) {
              logger.error('failed to unlock wallet:', err)
              throw err
            }
          }}
        >
          <h4 className='text-center mb-3'>Unlock LNC</h4>
          <PasswordInput
            label='password'
            name='password'
          />
          <div className='mt-5 d-flex justify-content-between'>
            <CancelButton onClick={() => { onClose(); cancelAndReject() }} />
            <SubmitButton variant='primary'>unlock</SubmitButton>
          </div>
        </Form>
      )
    }
    )
  })
}

// FIXME: pass me, status, showModal in useWallet hook
export async function sendPayment (bolt11, { pairingPhrase, password: configuredPassword }, { me, status, showModal, logger }) {
  const hash = bolt11Tags(bolt11).payment_hash

  return await mutex.runExclusive(async () => {
    let lnc
    try {
      lnc = await getLNC({ me })
      // TODO: pass status, showModal to unlock
      const password = await unlock({ password: configuredPassword }, { lnc, status, showModal, logger })
      // credentials need to be decrypted before connecting after a disconnect
      lnc.credentials.password = password || XXX_DEFAULT_PASSWORD
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
      try {
        lnc.disconnect()
        logger.info('disconnecting after:', `payment_hash=${hash}`)
        // wait for lnc to disconnect before releasing the mutex
        await new Promise((resolve, reject) => {
          let counter = 0
          const interval = setInterval(() => {
            if (lnc.isConnected) {
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
  })
}

function getLNC ({ me }) {
  if (window.lnc) return window.lnc
  window.lnc = new LNC({ namespace: me?.id ? `stacker:${me.id}` : undefined })
  return window.lnc
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
