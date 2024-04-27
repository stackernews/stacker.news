// https://github.com/getAlby/js-sdk/blob/master/src/webln/NostrWeblnProvider.ts

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Relay, finalizeEvent, nip04 } from 'nostr-tools'
import { parseNwcUrl } from '@/lib/url'
import { useWalletLogger } from '../logger'
import { Status } from '.'
import { bolt11Tags } from '@/lib/bolt11'

const NWCContext = createContext()

export function NWCProvider ({ children }) {
  const [nwcUrl, setNwcUrl] = useState('')
  const [walletPubkey, setWalletPubkey] = useState()
  const [relayUrl, setRelayUrl] = useState()
  const [secret, setSecret] = useState()
  const [status, setStatus] = useState()
  const logger = useWalletLogger('nwc')

  const name = 'NWC'
  const storageKey = 'webln:provider:nwc'

  const getInfo = useCallback(async (relayUrl, walletPubkey) => {
    logger.info(`requesting info event from ${relayUrl}`)

    let relay, sub
    try {
      relay = await Relay.connect(relayUrl).catch(() => {
        // NOTE: passed error is undefined for some reason
        const msg = `failed to connect to ${relayUrl}`
        logger.error(msg)
        throw new Error(msg)
      })
      logger.ok(`connected to ${relayUrl}`)
      return await new Promise((resolve, reject) => {
        const timeout = 5000
        const timer = setTimeout(() => {
          const msg = 'timeout waiting for info event'
          logger.error(msg)
          reject(new Error(msg))
          sub?.close()
        }, timeout)

        let found = false
        sub = relay.subscribe([
          {
            kinds: [13194],
            authors: [walletPubkey]
          }
        ], {
          onevent (event) {
            clearTimeout(timer)
            found = true
            logger.ok(`received info event from ${relayUrl}`)
            resolve(event)
          },
          onclose (reason) {
            clearTimeout(timer)
            if (!['closed by caller', 'relay connection closed by us'].includes(reason)) {
              // only log if not closed by us (caller)
              const msg = 'connection closed: ' + (reason || 'unknown reason')
              logger.error(msg)
              reject(new Error(msg))
            }
          },
          oneose () {
            clearTimeout(timer)
            if (!found) {
              const msg = 'EOSE received without info event'
              logger.error(msg)
              reject(new Error(msg))
            }
            sub?.close()
          }
        })
      })
    } finally {
      // For some reason, websocket is already in CLOSING or CLOSED state.
      // relay?.close()
      if (relay) logger.info(`closed connection to ${relayUrl}`)
    }
  }, [logger])

  const validateParams = useCallback(async ({ relayUrl, walletPubkey }) => {
    // validate connection by fetching info event
    // function needs to throw an error for formik validation to fail
    const event = await getInfo(relayUrl, walletPubkey)
    const supported = event.content.split(/[\s,]+/) // handle both spaces and commas
    logger.info('supported methods:', supported)
    if (!supported.includes('pay_invoice')) {
      const msg = 'wallet does not support pay_invoice'
      logger.error(msg)
      throw new Error(msg)
    }
    logger.ok('wallet supports pay_invoice')
  }, [logger])

  const loadConfig = useCallback(async () => {
    const configStr = window.localStorage.getItem(storageKey)
    setStatus(Status.Initialized)
    if (!configStr) {
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
      `relay=${params.relayUrl}`)

    try {
      await validateParams(params)
      setStatus(Status.Enabled)
      logger.ok('wallet enabled')
    } catch (err) {
      logger.info('wallet disabled')
      throw err
    }
  }, [validateParams, logger])

  const saveConfig = useCallback(async (config) => {
    // immediately store config so it's not lost even if config is invalid
    const { nwcUrl } = config
    setNwcUrl(nwcUrl)
    if (!nwcUrl) {
      setStatus(undefined)
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
      await validateParams(params)
      setStatus(Status.Enabled)
      logger.ok('wallet enabled')
    } catch (err) {
      setStatus(Status.Error)
      logger.info('wallet disabled')
      throw err
    }
  }, [validateParams, logger])

  const clearConfig = useCallback(() => {
    window.localStorage.removeItem(storageKey)
    setNwcUrl('')
    setRelayUrl(undefined)
    setWalletPubkey(undefined)
    setSecret(undefined)
    setStatus(undefined)
  }, [])

  const sendPayment = useCallback(async (bolt11) => {
    const hash = bolt11Tags(bolt11).payment_hash
    logger.info('sending payment:', `payment_hash=${hash}`)

    let relay, sub
    try {
      relay = await Relay.connect(relayUrl).catch(() => {
        // NOTE: passed error is undefined for some reason
        const msg = `failed to connect to ${relayUrl}`
        logger.error(msg)
        throw new Error(msg)
      })
      logger.ok(`connected to ${relayUrl}`)
      const ret = await new Promise(function (resolve, reject) {
        (async function () {
          // timeout since NWC is async (user needs to confirm payment in wallet)
          // timeout is same as invoice expiry
          const timeout = 180_000
          const timer = setTimeout(() => {
            const msg = 'timeout waiting for info event'
            logger.error(msg)
            reject(new Error(msg))
            sub?.close()
          }, timeout)

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

          const filter = {
            kinds: [23195],
            authors: [walletPubkey],
            '#e': [request.id]
          }
          sub = relay.subscribe([filter], {
            async onevent (response) {
              clearTimeout(timer)
              try {
                const content = JSON.parse(await nip04.decrypt(secret, walletPubkey, response.content))
                if (content.error) return reject(new Error(content.error.message))
                if (content.result) return resolve({ preimage: content.result.preimage })
              } catch (err) {
                return reject(err)
              }
            },
            onclose (reason) {
              clearTimeout(timer)
              if (!['closed by caller', 'relay connection closed by us'].includes(reason)) {
                // only log if not closed by us (caller)
                const msg = 'connection closed: ' + (reason || 'unknown reason')
                logger.error(msg)
                reject(new Error(msg))
              }
            }
          })
        })().catch(reject)
      })
      const preimage = ret.preimage
      logger.ok('payment successful:', `payment_hash=${hash}`, `preimage=${preimage}`)
      return ret
    } catch (err) {
      logger.error('payment failed:', `payment_hash=${hash}`, err.message || err.toString?.())
      throw err
    } finally {
      // For some reason, websocket is already in CLOSING or CLOSED state.
      // relay?.close()
      if (relay) logger.info(`closed connection to ${relayUrl}`)
    }
  }, [walletPubkey, relayUrl, secret, logger])

  useEffect(() => {
    loadConfig().catch(err => logger.error(err.message || err.toString?.()))
  }, [])

  const value = { name, nwcUrl, relayUrl, walletPubkey, secret, status, saveConfig, clearConfig, getInfo, sendPayment }
  return (
    <NWCContext.Provider value={value}>
      {children}
    </NWCContext.Provider>
  )
}

export function useNWC () {
  return useContext(NWCContext)
}
