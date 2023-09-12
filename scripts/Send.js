const { Relay, getPublicKey, calculateId, signId } = require('nostr')
const { unixTimestamp } = require('../lib/time')

exports.sendOnAllNetworks = async function (message) {
  console.log('sending:\n' + message.trim())
  const twitterSent = exports.sendToTwitter(message)
  const nostrSent = exports.sendToNostr(message)
  await twitterSent
  await nostrSent
  console.log('sent on all networks.')
}

exports.sendToTwitter = async function (message) {
  try {
    ;
  } catch (err) {
    console.error(err)
  }
}

exports.sendToNostr = async function (message) {
  try {
    const relay = Relay(process.env.NOSTR_RELAY)
    const pubkey = getPublicKey(process.env.NOSTR_PRIVKEY)
    const event = {
      pubkey,
      created_at: unixTimestamp(),
      kind: 1,
      content: message,
      tags: []
    }
    event.id = await calculateId(event)
    event.sig = await signId(process.env.NOSTR_PRIVKEY, event.id)
    await relay.send(['EVENT', event])
    console.log('event sent via', process.env.NOSTR_RELAY)
  } catch (err) {
    console.error(err)
  }
}
