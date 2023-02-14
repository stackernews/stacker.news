const { getInvoice } = require('ln-service')
const { Relay, signId, calculateId, getPublicKey } = require('nostr')

const nostrOptions = { startAfter: 5, retryLimit: 21, retryBackoff: true }

function nip57 ({ boss, lnd }) {
  return async function ({ data: { hash } }) {
    console.log('running nip57')

    let inv
    try {
      inv = await getInvoice({ id: hash, lnd })
    } catch (err) {
      console.log(err)
      // on lnd related errors, we manually retry which so we don't exponentially backoff
      await boss.send('nip57', { hash }, nostrOptions)
      return
    }

    try {
      const desc = JSON.parse(inv.description)
      const ptag = desc.tags.filter(t => t?.length >= 2 && t[0] === 'p')[0]
      const etag = desc.tags.filter(t => t?.length >= 2 && t[0] === 'e')[0]
      const relays = desc.tags.find(t => t?.length >= 2 && t[0] === 'relays').slice(1)

      const tags = [ptag]
      if (etag) {
        tags.push(etag)
      }
      tags.push(['bolt11', inv.request])
      tags.push(['description', inv.description])
      tags.push(['preimage', inv.secret])

      const e = {
        kind: 9735,
        pubkey: getPublicKey(process.env.NOSTR_PRIVATE_KEY),
        created_at: Math.floor(new Date(inv.confirmed_at).getTime() / 1000),
        content: '',
        tags
      }
      e.id = await calculateId(e)
      e.sig = await signId(process.env.NOSTR_PRIVATE_KEY, e.id)

      relays.forEach(r => {
        const timeout = 1000
        const relay = Relay(r)

        function timedout () {
          relay.close()
        }

        let timer = setTimeout(timedout, timeout)

        relay.on('open', () => {
          clearTimeout(timer)
          timer = setTimeout(timedout, timeout)
          relay.send(['EVENT', e])
        })

        relay.on('ok', () => {
          clearTimeout(timer)
          relay.close()
        })
      })
    } catch (e) {
      console.log(e)
    }
    console.log('dont running nip57')
  }
}

module.exports = { nip57 }
