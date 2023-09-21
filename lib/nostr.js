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
    
    const relays = ['wss://nostr.mutinywallet.com']

    if (userRelays) {
      relays = relays.concat(userRelays)
    }

    console.log(relays)

    let promises = [];
    
    if (signedEvent) {
      promises = relays.map((r) => 
        new Promise((resolve, reject) => {
          const timeout = 1000;
          const relay = new WebSocket(r);
          let timer;
          let isMessageSentSuccessfully = false;

          function timedout() {
            clearTimeout(timer);
            relay.close();
            reject(new Error(`relay timeout for ${r}`));

            return { error: `relay timeout for ${r}` };
          }

          timer = setTimeout(timedout, timeout);

          relay.onopen = function () {
            clearTimeout(timer);
            timer = setTimeout(timedout, timeout);
            relay.send(JSON.stringify(['EVENT', signedEvent]));
          };

          relay.onmessage = function (msg) {
            const m = JSON.parse(msg.data);
            if (m[0] === 'OK') {
              isMessageSentSuccessfully = true;
              clearTimeout(timer);
              relay.close();
              console.log('Successfully sent event to', r);
              resolve();
            }
          };

          relay.onerror = function (error) {
            clearTimeout(timer);
            console.log('WebSocket Error: ', error);
            reject(new Error(`relay error: Failed to send to ${r}`));

            return { error };
          };

          relay.onclose = function () {
            clearTimeout(timer);
            console.log(`Connection closed for ${r}`);
            if (!isMessageSentSuccessfully) { 
              // Check the flag here in the onclose method
              reject(new Error(`relay error: Failed to send to ${r}`));

              return { error: `relay error: Failed to send to ${r}` };
            }
          };
        })
      )

    } else {
      throw new Error('failed to sign event')
    }

    await Promise.all(promises);

    return { success: true };

  } catch (error) {
    console.error('Crosspost discussion error:', error);
    return { error };
  }
}