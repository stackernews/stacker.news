import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useWalletLogger } from '../logger'
import LNC from '@lightninglabs/lnc-web'
import { Status } from '.'
import { bolt11Tags } from '@/lib/bolt11'
import useModal from '../modal'
import { Form, PasswordInput, SubmitButton } from '../form'
import CancelButton from '../cancel-button'
import { Mutex } from 'async-mutex'

const LNCContext = createContext()
const mutex = new Mutex()

async function getLNC () {
  if (window.lnc) return window.lnc
  window.lnc = new LNC({ })
  return window.lnc
}

// default password if the user hasn't set one
export const XXX_DEFAULT_PASSWORD = 'password'

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

export function LNCProvider ({ children }) {
  const name = 'lnc'
  const logger = useWalletLogger(name)
  const [config, setConfig] = useState({})
  const [lnc, setLNC] = useState()
  const [status, setStatus] = useState()
  const [modal, showModal] = useModal()

  const getInfo = useCallback(async () => {
    logger.info('getInfo called')
    return await lnc.lightning.getInfo()
  }, [logger, lnc])

  const sendPayment = useCallback(async (bolt11) => {
    const hash = bolt11Tags(bolt11).payment_hash
    logger.info('sending payment:', `payment_hash=${hash}`)

    return await mutex.runExclusive(async () => {
      try {
        // credentials need to be decrypted before connecting after a disconnect
        lnc.credentials.password = config?.password || XXX_DEFAULT_PASSWORD
        await lnc.connect()
        const { paymentError, paymentPreimage: preimage } =
          await lnc.lnd.lightning.sendPaymentSync({ payment_request: bolt11 })

        if (paymentError) throw new Error(paymentError)
        if (!preimage) throw new Error('No preimage in response')

        logger.ok('payment successful:', `payment_hash=${hash}`, `preimage=${preimage}`)
        return { preimage }
      } catch (err) {
        logger.error('payment failed:', `payment_hash=${hash}`, err.message || err.toString?.())
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
  }, [logger, lnc, config])

  const saveConfig = useCallback(async config => {
    setConfig(config)

    try {
      lnc.credentials.pairingPhrase = config.pairingPhrase
      lnc.credentials.password = config?.password || XXX_DEFAULT_PASSWORD
      await lnc.connect()
      await validateNarrowPerms(lnc)
      lnc.credentials.password = config?.password || XXX_DEFAULT_PASSWORD
      setStatus(Status.Enabled)
      logger.ok('wallet enabled')
    } catch (err) {
      setStatus(Status.Error)
      logger.error('invalid config:', err)
      logger.info('wallet disabled')
      throw err
    } finally {
      lnc.disconnect()
    }
  }, [logger, lnc])

  const clearConfig = useCallback(async () => {
    await lnc.credentials.clear(false)
    if (lnc.isConnected) lnc.disconnect()
    setStatus(undefined)
    setConfig({})
    logger.info('cleared config')
  }, [logger, lnc])

  const unlock = useCallback(async (connect) => {
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
                setStatus(Status.Enabled)
                setConfig({ pairingPhrase: lnc.credentials.pairingPhrase, password: values.password })
                logger.ok('wallet enabled')
                onClose()
                resolve()
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
      }, { onClose: cancelAndReject })
    })
  }, [logger, showModal, setConfig, lnc])

  useEffect(() => {
    (async () => {
      try {
        const lnc = await getLNC()
        setLNC(lnc)
        setStatus(Status.Initialized)
        if (lnc.credentials.isPaired) {
          try {
            // try the default password
            lnc.credentials.password = XXX_DEFAULT_PASSWORD
          } catch (err) {
            setStatus(Status.Locked)
            logger.info('wallet needs password before enabling')
            return
          }
          setStatus(Status.Enabled)
          setConfig({ pairingPhrase: lnc.credentials.pairingPhrase, password: lnc.credentials.password })
        }
      } catch (err) {
        setStatus(Status.Error)
        logger.error('wallet could not be loaded', err)
      }
    })()
  }, [setStatus, setConfig, logger])

  return (
    <LNCContext.Provider value={{ name, status, unlock, getInfo, sendPayment, config, saveConfig, clearConfig }}>
      {children}
      {modal}
    </LNCContext.Provider>
  )
}

export function useLNC () {
  return useContext(LNCContext)
}
