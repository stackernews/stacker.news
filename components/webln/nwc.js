// https://github.com/getAlby/js-sdk/blob/master/src/webln/NostrWeblnProvider.ts

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Relay, finalizeEvent, nip04 } from 'nostr-tools'
import { parseNwcUrl } from '../../lib/url'

const NWCContext = createContext()

export function NWCProvider ({ children }) {
  const [nwcUrl, setNwcUrl] = useState('')
  const [walletPubkey, setWalletPubkey] = useState()
  const [relayUrl, setRelayUrl] = useState()
  const [secret, setSecret] = useState()
  const [enabled, setEnabled] = useState()
  const [initialized, setInitialized] = useState(false)

  const relayRef = useRef()

  const name = 'NWC'
  const storageKey = 'webln:provider:nwc'

  const updateRelay = async (relayUrl) => {
    try {
      relayRef.current?.close()
      if (relayUrl) relayRef.current = await Relay.connect(relayUrl)
    } catch (err) {
      console.error(err)
    }
  }

  const loadConfig = useCallback(async () => {
    const configStr = window.localStorage.getItem(storageKey)
    if (!configStr) {
      setEnabled(undefined)
      setInitialized(true)
      return
    }

    const config = JSON.parse(configStr)

    const { nwcUrl } = config
    setNwcUrl(nwcUrl)

    const params = parseNwcUrl(nwcUrl)
    setRelayUrl(params.relayUrl)
    setWalletPubkey(params.walletPubkey)
    setSecret(params.secret)

    try {
      await validateParams(params)
      setEnabled(true)
      await updateRelay(params.relayUrl)
    } catch (err) {
      console.error('invalid NWC config:', err)
      setEnabled(false)
      throw err
    } finally {
      setInitialized(true)
    }
  }, [])

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

    try {
      await validateParams(params)
      setEnabled(true)
      await updateRelay(params.relayUrl)
    } catch (err) {
      console.error('invalid NWC config:', err)
      setEnabled(false)
      throw err
    }
  }, [])

  const clearConfig = useCallback(() => {
    window.localStorage.removeItem(storageKey)
    setNwcUrl('')
    setRelayUrl(undefined)
    setWalletPubkey(undefined)
    setSecret(undefined)
    setEnabled(undefined)
  }, [])

  const sendPayment = useCallback((bolt11) => {
    return new Promise(function (resolve, reject) {
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
  }, [walletPubkey, secret])

  const getInfo = useCallback(() => getInfoWithRelay(relayRef?.current, walletPubkey), [relayRef?.current, walletPubkey])

  useEffect(() => {
    loadConfig().catch(console.error)
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

async function validateParams ({ relayUrl, walletPubkey, secret }) {
  let infoRelay
  try {
    // validate connection by fetching info event
    infoRelay = await Relay.connect(relayUrl)
    return await getInfoWithRelay(infoRelay, walletPubkey)
  } finally {
    infoRelay?.close()
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
        const supported = event.content.split(',')
        supported.includes('pay_invoice') ? resolve() : reject(new Error('wallet does not support pay_invoice'))
        sub.close()
      },
      onclose (reason) {
        clearTimeout(timer)
        reject(new Error(reason))
      },
      oneose () {
        clearTimeout(timer)
        reject(new Error('info event not found'))
      }
    })
  })
}
