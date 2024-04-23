import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useWalletLogger } from '../logger'
import LNC from '@lightninglabs/lnc-web'
import { SSR } from '@/lib/constants'
import lnpr from 'bolt11'

const LNCContext = createContext()

function getLNC () {
  if (SSR) return null
  window.lnc ||= new LNC({})
  return window.lnc
}

// TODO: dont hardcode password
const XXX_HARD_CODED_PASSWORD = 'password'

export function LNCProvider ({ children }) {
  const name = 'lnc'
  const logger = useWalletLogger(name)
  const [initialized, setInitialized] = useState(false)
  const [config, setConfig] = useState({})
  const lnc = getLNC()

  const getInfo = useCallback(async () => {
    logger.info('getInfo')
    return await lnc.lightning.getInfo()
  }, [logger, lnc])

  const sendPayment = useCallback(async (bolt11) => {
    const inv = lnpr.decode(bolt11)
    const hash = inv.tagsObject.payment_hash
    logger.info('sending payment:', `payment_hash=${hash}`)

    try {
      const { paymentError, paymentPreimage } = await lnc.lnd.lightning.sendPaymentSync({ payment_request: bolt11 })

      if (paymentError) {
        throw new Error(paymentError)
      }
      if (!paymentPreimage) {
        throw new Error('No preimage in response')
      }

      logger.info('sendPayment')

      return {
        preimage: paymentPreimage
      }
    } catch (err) {
      logger.error('sendPayment', err)
    }
  }, [logger])

  const saveConfig = useCallback(async config => {
    setConfig(config)
    lnc.credentials.pairingPhrase = config.pairingPhrase

    try {
      await lnc.connect()
      await lnc.lnd.lightning.getInfo()
      lnc.credentials.password = config.password || XXX_HARD_CODED_PASSWORD
      logger.ok('wallet enabled')
    } catch (err) {
      logger.error('invalid config:', err)
      logger.info('wallet disabled')
    }
  }, [logger, lnc])

  const clearConfig = useCallback(async () => {
    lnc.disconnect()
    lnc.credentials.clear(false)
    logger.info('cleared config')
  }, [logger, lnc])

  const loadConfig = useCallback(async () => {
    // status is set if lnc is initializing ... calling lnc.connect again will
    // cause an infinite loop
    if (lnc.status) {
      logger.info('already initialized')
      return
    }

    // if we haven't been paired, we can't connect
    if (!lnc.credentials.isPaired) {
      setInitialized(true)
      logger.info('wallet not paired')
      return
    }

    setInitialized(true)
    setConfig({ pairingPhrase: lnc.credentials.pairingPhrase })

    if (lnc.isConnected) {
      logger.info('already connected')
      return
    }

    logger.info('connecting paired wallet')

    try {
      lnc.credentials.password = XXX_HARD_CODED_PASSWORD
      await lnc.connect()
      await lnc.lnd.lightning.getInfo()
      logger.ok('wallet enabled')
    } catch (err) {
      logger.error('invalid config:', err)
      logger.info('wallet disabled')
    }
  }, [setInitialized, logger, lnc])

  useEffect(() => {
    loadConfig().catch(err => logger.error(err.message || err.toString?.()))
  }, [])

  return (
    <LNCContext.Provider value={{ name, config, initialized, enabled: lnc?.isConnected, saveConfig, clearConfig, getInfo, sendPayment }}>
      {children}
    </LNCContext.Provider>
  )
}

export function useLNC () {
  return useContext(LNCContext)
}
