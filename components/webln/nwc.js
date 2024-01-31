// https://github.com/getAlby/js-sdk/blob/master/src/webln/NostrWeblnProvider.ts

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Relay, finalizeEvent, nip04 } from 'nostr-tools'

const NWCContext = createContext()

export function NWCProvider ({ children }) {
  const [nwcUrl, setNwcUrl] = useState()
  const [walletPubkey, setWalletPubkey] = useState()
  const [relayUrl, setRelayUrl] = useState()
  const [secret, setSecret] = useState()
  const [enabled, setEnabled] = useState()

  const name = 'NWC'
  const storageKey = 'webln:provider:nwc'

  const loadConfig = useCallback(() => {
    const config = window.localStorage.getItem(storageKey)
    if (!config) return
    const configJSON = JSON.parse(config)
    setNwcUrl(configJSON.nwcUrl)
  }, [])

  const saveConfig = useCallback(async (config) => {
    setNwcUrl(config.nwcUrl)
    // XXX Even though NWC allows to configure budget,
    // this is definitely not ideal from a security perspective.
    window.localStorage.setItem(storageKey, JSON.stringify(config))
  }, [])

  const clearConfig = useCallback(() => {
    window.localStorage.removeItem(storageKey)
    setNwcUrl(null)
  }, [])

  const sendPayment = useCallback((bolt11) => {
    return new Promise(function (resolve, reject) {
      (async function () {
        // need big timeout since NWC is async (user needs to confirm payment in wallet)

        // XXX set this to mock NWC relays
        const MOCK_NWC_RELAY = true

        const timeout = MOCK_NWC_RELAY ? 3000 : 60000
        let timer
        const resetTimer = () => {
          clearTimeout(timer)
          timer = setTimeout(() => {
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

        const relay = await Relay.connect(relayUrl)

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
          // for some reason, 'authors' must be set in the filter else you will debug your code for hours.
          // this doesn't seem to be documented in NIP-01 or NIP-47.
          authors: [walletPubkey],
          '#e': [request.id]
        }
        const sub = relay.subscribe([filter], {
          async onevent (response) {
            resetTimer()
            // TODO: check if we need verification here. does nostr-tools verify events?
            // can we trust the NWC relay to respect our filters?
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
            reject(new Error(reason))
          }
        })
      })().catch(reject)
    })
  }, [relayUrl, walletPubkey, secret])

  const getInfo = useCallback(() => {
    return new Promise(function (resolve, reject) {
      (async function () {
        const timeout = 5000
        const timer = setTimeout(() => reject(new Error('timeout')), timeout)
        const relay = await Relay.connect(relayUrl)
        const sub = relay.subscribe([
          {
            kinds: [13194],
            authors: [walletPubkey]
          }
        ], {
          onevent (event) {
            const supported = event.content.split()
            resolve(supported)
          },
          // some relays like nostr.mutinywallet.com don't support NIP-47 info events
          // so we simply check that we received EOSE
          oneose () {
            clearTimeout(timer)
            sub.close()
            // we assume that pay_invoice is supported
            // (which should be mandatory to support since it's described in NIP-47)
            const supported = ['pay_invoice']
            resolve(supported)
          }
        })
      })().catch(reject)
    })
  }, [relayUrl, walletPubkey])

  useEffect(() => {
    // update enabled
    (async function () {
      if (!(relayUrl && walletPubkey && secret)) {
        setEnabled(undefined)
        return
      }
      try {
        const supported = await getInfo()
        setEnabled(supported.includes('pay_invoice'))
      } catch (err) {
        console.error(err)
        setEnabled(false)
      }
    })()
  }, [relayUrl, walletPubkey, secret, getInfo])

  useEffect(() => {
    // parse nwc URL on updates
    // and sync with other state variables
    if (!nwcUrl) {
      setRelayUrl(null)
      setWalletPubkey(null)
      setSecret(null)
      return
    }
    const params = parseWalletConnectUrl(nwcUrl)
    setRelayUrl(params.relayUrl)
    setWalletPubkey(params.walletPubkey)
    setSecret(params.secret)
  }, [nwcUrl])

  useEffect(loadConfig, [])

  const value = { name, nwcUrl, relayUrl, walletPubkey, secret, saveConfig, clearConfig, enabled, sendPayment }
  return (
    <NWCContext.Provider value={value}>
      {children}
    </NWCContext.Provider>
  )
}

export function useNWC () {
  return useContext(NWCContext)
}

function parseWalletConnectUrl (walletConnectUrl) {
  walletConnectUrl = walletConnectUrl
    .replace('nostrwalletconnect://', 'http://')
    .replace('nostr+walletconnect://', 'http://') // makes it possible to parse with URL in the different environments (browser/node/...)
  const url = new URL(walletConnectUrl)
  const options = {}
  options.walletPubkey = url.host
  const secret = url.searchParams.get('secret')
  const relayUrl = url.searchParams.get('relay')
  if (secret) {
    options.secret = secret
  }
  if (relayUrl) {
    options.relayUrl = relayUrl
  }
  return options
}
