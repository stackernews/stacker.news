// https://github.com/getAlby/js-sdk/blob/master/src/webln/NostrWeblnProvider.ts

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Relay, finalizeEvent, nip04 } from 'nostr-tools'
import { parseNwcUrl } from '@/lib/url'
import { useWalletLogger } from '../logger'
import lnpr from 'bolt11'

const NWCContext = createContext()

export function NWCProvider ({ children }) {
  const [nwcUrl, setNwcUrl] = useState('')
  const [walletPubkey, setWalletPubkey] = useState()
  const [relayUrl, setRelayUrl] = useState()
  const [secret, setSecret] = useState()
  const [enabled, setEnabled] = useState()
  const [initialized, setInitialized] = useState(false)
  const logger = useWalletLogger('nwc')

  const relayRef = useRef()

  const name = 'NWC'
  const storageKey = 'webln:provider:nwc'

  const updateRelay = async (relayUrl) => {
    try {
      if (relayRef.current) {
        relayRef.current.close()
        logger.info('disconnected from', relayRef.current.url)
      }
      if (relayUrl) {
        relayRef.current = await Relay.connect(relayUrl)
        logger.ok(`connected to ${relayUrl}`)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const loadConfig = useCallback(async () => {
    const configStr = window.localStorage.getItem(storageKey)
    if (!configStr) {
      setEnabled(undefined)
      setInitialized(true)
      logger.info('no existing config found')
      return
    }

    const config = JSON.parse(configStr)

    const { nwcUrl } = config
    setNwcUrl(nwcUrl)

    const params = parseNwcUrl(nwcUrl)
    setRelayUrl(params.relayUrl)
    setWalletPubkey(params.walletPubkey)
    setSecret(params.secret)

    logger.info(
      'loaded wallet config: ' +
      'secret=****** ' +
      `pubkey=${params.walletPubkey.slice(0, 6)}..${params.walletPubkey.slice(-6)} ` +
      `relay=${params.relayUrl}`
    )

    try {
      logger.info(`requesting info event from ${params.relayUrl}`)
      await validateParams({ ...params, logger })
      logger.ok('info event received')
      await updateRelay(params.relayUrl)
      setEnabled(true)
      logger.ok('wallet enabled')
    } catch (err) {
      logger.error('invalid config:', err)
      setEnabled(false)
      logger.info('wallet disabled')
      throw err
    } finally {
      setInitialized(true)
    }
  }, [logger])

  const saveConfig = useCallback(async (config) => {
    // immediately store config so it's not lost even if config is invalid
    const { nwcUrl } = config
    setNwcUrl(nwcUrl)
    if (!nwcUrl) {
      setEnabled(undefined)
      return
    }

    const params = parseNwcUrl(nwcUrl)
    setRelayUrl(params.relayUrl)
    setWalletPubkey(params.walletPubkey)
    setSecret(params.secret)

    // XXX Even though NWC allows to configure budget,
    // this is definitely not ideal from a security perspective.
    window.localStorage.setItem(storageKey, JSON.stringify(config))

    logger.info(
      'saved wallet config: ' +
      'secret=****** ' +
      `pubkey=${params.walletPubkey.slice(0, 6)}..${params.walletPubkey.slice(-6)} ` +
      `relay=${params.relayUrl}`)

    try {
      logger.info(`requesting info event from ${params.relayUrl}`)
      await validateParams({ ...params, logger })
      logger.ok('info event received')
      await updateRelay(params.relayUrl)
      setEnabled(true)
      logger.ok('wallet enabled')
    } catch (err) {
      logger.error('invalid config:', err)
      setEnabled(false)
      logger.info('wallet disabled')
      throw err
    }
  }, [logger])

  const clearConfig = useCallback(() => {
    window.localStorage.removeItem(storageKey)
    setNwcUrl('')
    setRelayUrl(undefined)
    setWalletPubkey(undefined)
    setSecret(undefined)
    setEnabled(undefined)
  }, [])

  const sendPayment = useCallback(async (bolt11) => {
    const inv = lnpr.decode(bolt11)
    const hash = inv.tagsObject.payment_hash
    // use short hash for logging to prevent x-overflow
    const shortHash = `${hash.slice(0, 8)}..${hash.slice(-8)}`
    logger.info('sending payment:', shortHash)
    try {
      const ret = await new Promise(function (resolve, reject) {
        const relay = relayRef.current
        if (!relay) {
          return reject(new Error('not connected to relay'))
        }
        (async function () {
        // XXX set this to mock NWC relays
          const MOCK_NWC_RELAY = false

          // timeout since NWC is async (user needs to confirm payment in wallet)
          // timeout is same as invoice expiry
          const timeout = MOCK_NWC_RELAY ? 3000 : 180_000
          let timer
          const resetTimer = () => {
            clearTimeout(timer)
            timer = setTimeout(() => {
              sub?.close()
              if (MOCK_NWC_RELAY) {
                const heads = Math.random() < 0.5
                if (heads) {
                  return resolve({ preimage: null })
                }
                return reject(new Error('mock error'))
              }
              return reject(new Error('timeout'))
            }, timeout)
          }
          if (MOCK_NWC_RELAY) return resetTimer()

          const payload = {
            method: 'pay_invoice',
            params: { invoice: bolt11 }
          }
          const content = await nip04.encrypt(secret, walletPubkey, JSON.stringify(payload))
          const request = finalizeEvent({
            kind: 23194,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', walletPubkey]],
            content
          }, secret)
          await relay.publish(request)
          resetTimer()

          const filter = {
            kinds: [23195],
            authors: [walletPubkey],
            '#e': [request.id]
          }
          const sub = relay.subscribe([filter], {
            async onevent (response) {
              resetTimer()
              try {
                const content = JSON.parse(await nip04.decrypt(secret, walletPubkey, response.content))
                if (content.error) return reject(new Error(content.error.message))
                if (content.result) return resolve({ preimage: content.result.preimage })
              } catch (err) {
                return reject(err)
              } finally {
                clearTimeout(timer)
                sub.close()
              }
            },
            onclose (reason) {
              clearTimeout(timer)
              reject(new Error(reason))
            }
          })
        })().catch(reject)
      })
      logger.ok('payment successful:', shortHash)
      return ret
    } catch (err) {
      logger.error('payment failed:', shortHash, err.message)
      throw err
    }
  }, [walletPubkey, secret, logger])

  const getInfo = useCallback(() => getInfoWithRelay(relayRef?.current, walletPubkey), [relayRef?.current, walletPubkey])

  useEffect(() => {
    loadConfig().catch(err => logger.error(err.message))
  }, [])

  const value = { name, nwcUrl, relayUrl, walletPubkey, secret, initialized, enabled, saveConfig, clearConfig, getInfo, sendPayment }
  return (
    <NWCContext.Provider value={value}>
      {children}
    </NWCContext.Provider>
  )
}

export function useNWC () {
  return useContext(NWCContext)
}

async function validateParams ({ relayUrl, walletPubkey, secret, logger }) {
  let infoRelay
  try {
    // validate connection by fetching info event
    infoRelay = await Relay.connect(relayUrl)
    logger.ok(`connected to ${relayUrl}`)
    await getInfoWithRelay(infoRelay, walletPubkey, logger)
  } finally {
    infoRelay?.close()
    logger.info(`closed connection to ${relayUrl}`)
  }
}

async function getInfoWithRelay (relay, walletPubkey) {
  return await new Promise((resolve, reject) => {
    const timeout = 5000
    const timer = setTimeout(() => {
      reject(new Error('timeout waiting for response'))
      sub?.close()
    }, timeout)

    const sub = relay.subscribe([
      {
        kinds: [13194],
        authors: [walletPubkey]
      }
    ], {
      onevent (event) {
        clearTimeout(timer)
        const supported = event.content.split(/[\s,]+/) // handle both spaces and commas
        supported.includes('pay_invoice') ? resolve() : reject(new Error('wallet does not support pay_invoice'))
        sub.close()
      },
      onclose (reason) {
        clearTimeout(timer)
        reject(new Error(reason || 'connection closed: reason unknown'))
      },
      oneose () {
        clearTimeout(timer)
        reject(new Error('info event not found'))
      }
    })
  })
}
