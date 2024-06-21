import { NOSTR_PUBKEY_HEX } from '@/lib/nostr'
import { parseNwcUrl } from '@/lib/url'
import { Relay, finalizeEvent, nip04 } from 'nostr-tools'
import { object, string } from 'yup'

export const name = 'nwc'

export const fields = [
  {
    name: 'nwcUrl',
    label: 'connection',
    type: 'password'
  }
]

export const card = {
  title: 'NWC',
  subtitle: 'use Nostr Wallet Connect for payments',
  badges: ['send only', 'non-custodialish']
}

export const schema = object({
  nwcUrl: string()
    .required('required')
    .test(async (nwcUrl, context) => {
      // run validation in sequence to control order of errors
      // inspired by https://github.com/jquense/yup/issues/851#issuecomment-1049705180
      try {
        await string().required('required').validate(nwcUrl)
        await string().matches(/^nostr\+?walletconnect:\/\//, { message: 'must start with nostr+walletconnect://' }).validate(nwcUrl)
        let relayUrl, walletPubkey, secret
        try {
          ({ relayUrl, walletPubkey, secret } = parseNwcUrl(nwcUrl))
        } catch {
          // invalid URL error. handle as if pubkey validation failed to not confuse user.
          throw new Error('pubkey must be 64 hex chars')
        }
        await string().required('pubkey required').trim().matches(NOSTR_PUBKEY_HEX, 'pubkey must be 64 hex chars').validate(walletPubkey)
        await string().required('relay url required').trim().wss('relay must use wss://').validate(relayUrl)
        await string().required('secret required').trim().matches(/^[0-9a-fA-F]{64}$/, 'secret must be 64 hex chars').validate(secret)
      } catch (err) {
        return context.createError({ message: err.message })
      }
      return true
    })
})

export async function validate ({ logger, nwcUrl }) {
  const { relayUrl, walletPubkey } = parseNwcUrl(nwcUrl)

  logger.info(`requesting info event from ${relayUrl}`)
  const relay = await Relay
    .connect(relayUrl)
    .catch(() => {
      // NOTE: passed error is undefined for some reason
      const msg = `failed to connect to ${relayUrl}`
      logger.error(msg)
      throw new Error(msg)
    })
  logger.ok(`connected to ${relayUrl}`)

  try {
    return await new Promise((resolve, reject) => {
      let found = false
      const sub = relay.subscribe([
        {
          kinds: [13194],
          authors: [walletPubkey]
        }
      ], {
        onevent (event) {
          found = true
          logger.ok(`received info event from ${relayUrl}`)
          resolve(event)
        },
        onclose (reason) {
          if (!['closed by caller', 'relay connection closed by us'].includes(reason)) {
            // only log if not closed by us (caller)
            const msg = 'connection closed: ' + (reason || 'unknown reason')
            logger.error(msg)
            reject(new Error(msg))
          }
        },
        oneose () {
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
}

export async function sendPayment ({ bolt11, nwcUrl, logger }) {
  const { relayUrl, walletPubkey, secret } = parseNwcUrl(nwcUrl)

  const relay = await Relay.connect(relayUrl).catch(() => {
    // NOTE: passed error is undefined for some reason
    const msg = `failed to connect to ${relayUrl}`
    logger.error(msg)
    throw new Error(msg)
  })
  logger.ok(`connected to ${relayUrl}`)

  try {
    const ret = await new Promise(function (resolve, reject) {
      (async function () {
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
        relay.subscribe([filter], {
          async onevent (response) {
            try {
              const content = JSON.parse(await nip04.decrypt(secret, walletPubkey, response.content))
              if (content.error) return reject(new Error(content.error.message))
              if (content.result) return resolve({ preimage: content.result.preimage })
            } catch (err) {
              return reject(err)
            }
          },
          onclose (reason) {
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
    return ret
  } finally {
    // For some reason, websocket is already in CLOSING or CLOSED state.
    // relay?.close()
    if (relay) logger.info(`closed connection to ${relayUrl}`)
  }
}
