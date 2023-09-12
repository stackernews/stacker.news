import { bech32 } from 'bech32'

export const NOSTR_PUBKEY_HEX = /^[0-9a-fA-F]{64}$/
export const NOSTR_PUBKEY_BECH32 = /^npub1[02-9ac-hj-np-z]+$/
export const NOSTR_MAX_RELAY_NUM = 20
export const NOSTR_ZAPPLE_PAY_NPUB = 'npub1wxl6njlcgygduct7jkgzrvyvd9fylj4pqvll6p32h59wyetm5fxqjchcan'

export function hexToBech32 (hex, prefix = 'npub') {
  return bech32.encode(prefix, bech32.toWords(Buffer.from(hex, 'hex')))
}

export function nostrZapDetails (zap) {
  let { pubkey, content, tags } = zap
  let npub = hexToBech32(pubkey)
  if (npub === NOSTR_ZAPPLE_PAY_NPUB) {
    const znpub = content.match(/^From: nostr:(npub1[02-9ac-hj-np-z]+)$/)?.[1]
    if (znpub) {
      npub = znpub
      // zapple pay does not support user content
      content = null
    }
  }
  const event = tags.filter(t => t?.length >= 2 && t[0] === 'e')?.[0]?.[1]
  const note = event ? hexToBech32(event, 'note') : null

  return { npub, content, note }
}

export async function crosspostDiscussion(item, id, userRelays) {
  try {
    const userPubkey = await window.nostr.getPublicKey()

    const timestamp = Math.floor(Date.now() / 1000)

    const event = {
      created_at: timestamp,
      kind: 30023,
      content: item.text,
      tags: [
        ['d', `https://stacker.news/items/${id}`],
        ['a', `30023:${userPubkey}:https://stacker.news/items/${id}`, 'wss://nostr.mutinywallet.com'],
        ['title', item.title],
        ['published_at', timestamp.toString()]
      ],
    };

    const signedEvent = await window.nostr.signEvent(event);
    
    const relays = [...userRelays, 'wss://nostr.mutinywallet.com']

    if (signedEvent) {
      await Promise.allSettled(
        relays.map(r => new Promise((resolve, reject) => {
          const timeout = 1000
          const relay = new WebSocket(r)
    
          function timedout () {
            relay.close()
            console.log('failed to send to', r)
            reject(new Error('relay timeout'))
          }
    
          let timer = setTimeout(timedout, timeout)
    
          relay.onopen = function () {
            console.log('sending to', r)
            clearTimeout(timer)
            timer = setTimeout(timedout, timeout)
            relay.send(JSON.stringify(['EVENT', signedEvent]))
          }
    
          relay.onmessage = function (msg) {
            const m = JSON.parse(msg.data)
            console.log(m)
            if(m[0] == 'OK') {
              clearTimeout(timer)
              relay.close()
              console.log('sent event to', r)
              resolve()
            }
          }
    
          relay.onerror = function (msg) {
            console.log(msg)
            relay.close()
            console.log('failed to send to', r)
            reject(new Error('relay error'))
          }
        })))
    } else {
      console.log('failed to sign event')
      // TODO: handle error
    }

  } catch (error) {
    console.error('Crossposting error:', error);
    // TODO: handle error
  }
}