import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useWalletLogger } from '../logger'
import LNC from '@lightninglabs/lnc-web'
import { Status } from '.'
import { bolt11Tags } from '@/lib/bolt11'
import useModal from '../modal'
import { Form, PasswordInput, SubmitButton } from '../form'
import CancelButton from '../cancel-button'

const LNCContext = createContext()

async function getLNC () {
  if (window.lnc) return window.lnc
  window.lnc = new LNC({ })
  await connectLNC(window.lnc)
  return window.lnc
}

const INVALID_PASSWORD = 'Invalid password'

async function connectLNC (lnc, config) {
  // if there's a pairing phrase, this is a new connection
  if (config?.pairingPhrase) {
    lnc.credentials.pairingPhrase = config.pairingPhrase
  } else if (lnc.credentials.isPaired) {
    // if we are paired without a pairing phrase, we need to decrypt the credentials
    try {
      lnc.credentials.password = config?.password || XXX_HARD_CODED_PASSWORD
    } catch (err) {
      throw new Error(INVALID_PASSWORD)
    }
  } else {
    // we can't connect without a pairing phrase or decrypted credentials
    return
  }

  await lnc.connect()
  await lnc.lnd.lightning.getInfo()

  lnc.credentials.password = config?.password || XXX_HARD_CODED_PASSWORD
}

// TODO: dont hardcode password
const XXX_HARD_CODED_PASSWORD = 'password'

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

    try {
      const { paymentError, paymentPreimage: preimage } =
        await lnc.lnd.lightning.sendPaymentSync({ payment_request: bolt11 })

      if (paymentError) throw new Error(paymentError)
      if (!preimage) throw new Error('No preimage in response')

      logger.ok('payment successful:', `payment_hash=${hash}`, `preimage=${preimage}`)
      return { preimage }
    } catch (err) {
      logger.error('payment failed:', `payment_hash=${hash}`, err.message || err.toString?.())
    }
  }, [logger, lnc])

  const saveConfig = useCallback(async config => {
    setConfig(config)

    try {
      await connectLNC(lnc, config)
      setStatus(Status.Enabled)
      logger.ok('wallet enabled')
    } catch (err) {
      setStatus(Status.Error)
      await lnc.disconnect()
      logger.error('invalid config:', err)
      logger.info('wallet disabled')
      throw err
    }
  }, [logger, lnc])

  const clearConfig = useCallback(async () => {
    await lnc.disconnect()
    await lnc.credentials.clear(false)
    setStatus(undefined)
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
                await connectLNC(lnc, values)
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
  }, [logger, showModal, lnc])

  useEffect(() => {
    (async () => {
      try {
        const lnc = await getLNC()
        setLNC(lnc)
        setStatus(Status.Initialized)
        if (lnc?.isConnected) {
          await lnc.lnd.lightning.getInfo() // check connection
          setStatus(Status.Enabled)
          setConfig({ pairingPhrase: lnc.credentials.pairingPhrase, password: lnc.credentials.password })
        }
      } catch (err) {
        if (err.message === INVALID_PASSWORD) {
          setStatus(Status.Locked)
          logger.info('wallet needs password before enabling')
        } else {
          setStatus(Status.Error)
          logger.error('wallet could not be loaded', err)
        }
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
