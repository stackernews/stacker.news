import bip39Words from '@/lib/bip39-words'
import LNC from '@lightninglabs/lnc-web'
import { Mutex } from 'async-mutex'
import { string, array, object } from 'yup'
import { Form, PasswordInput, SubmitButton } from '@/components/form'
import CancelButton from '@/components/cancel-button'
import { InvoiceCanceledError, InvoiceExpiredError } from '@/components/payment'
import { bolt11Tags } from '@/lib/bolt11'
import { Status } from '@/components/wallet'

export const name = 'lnc'

export const fields = [
  {
    name: 'pairingPhrase',
    label: 'pairing phrase',
    type: 'password',
    help: 'We only need permissions for the uri `/lnrpc.Lightning/SendPaymentSync`\n\nCreate a budgeted account with narrow permissions:\n\n```$ litcli accounts create --balance <budget>```\n\n```$ litcli sessions add --type custom --label <your label> --account_id <account_id> --uri /lnrpc.Lightning/SendPaymentSync```\n\nGrab the `pairing_secret_mnemonic` from the output and paste it here.'
  },
  {
    name: 'password',
    label: 'password',
    type: 'password',
    hint: 'encrypts your pairing phrase when stored locally',
    optional: true
  }
]

export const card = {
  title: 'LNC',
  subtitle: 'use Lightning Node Connect for LND payments',
  badges: ['send only', 'non-custodialish', 'budgetable']
}

const XXX_DEFAULT_PASSWORD = 'password'

export async function validate ({ me, logger, pairingPhrase, password }) {
  const lnc = await getLNC({ me })
  try {
    lnc.credentials.pairingPhrase = pairingPhrase
    await lnc.connect()
    await validateNarrowPerms(lnc)
    lnc.credentials.password = password || XXX_DEFAULT_PASSWORD
  } finally {
    lnc.disconnect()
  }
}

export const schema = object({
  pairingPhrase: array()
    .transform(function (value, originalValue) {
      if (this.isType(value) && value !== null) {
        return value
      }
      return originalValue ? originalValue.split(/[\s]+/) : []
    })
    .of(string().trim().oneOf(bip39Words, ({ value }) => `'${value}' is not a valid pairing phrase word`))
    .min(2, 'needs at least two words')
    .max(10, 'max 10 words')
    .required('required'),
  password: string()
})

const mutex = new Mutex()

export async function unlock ({ lnc, password, status, showModal, logger }) {
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
              logger.ok('wallet enabled')
              onClose()
              resolve(values.password)
            } catch (err) {
              logger.error('failed attempt to unlock wallet', err)
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

export async function sendPayment ({ bolt11, pairingPhrase, password: configuredPassword, logger }) {
  const hash = bolt11Tags(bolt11).payment_hash

  return await mutex.runExclusive(async () => {
    let lnc
    try {
      lnc = await getLNC()
      const password = await unlock({ lnc, password: configuredPassword })
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

async function validateNarrowPerms (lnc) {
  if (!lnc.hasPerms('lnrpc.Lightning.SendPaymentSync')) {
    throw new Error('missing permission: lnrpc.Lightning.SendPaymentSync')
  }
  if (lnc.hasPerms('lnrpc.Lightning.SendCoins')) {
    throw new Error('too broad permission: lnrpc.Wallet.SendCoins')
  }
  // TODO: need to check for more narrow permissions
  // blocked by https://github.com/lightninglabs/lnc-web/issues/112
}
