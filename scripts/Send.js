const { TwitterApi } = require('twitter-api-v2')
const { Relay, getPublicKey, calculateId, signId } = require('nostr')
const { unixTimestamp } = require('../lib/time')

exports.sendOnAllNetworks = async function (message) {
  message = message.trim()
  console.log('sending:\n' + message)
  const twitterSent = exports.sendToTwitter(message)
  const nostrSent = exports.sendToNostr(message)
  await twitterSent
  await nostrSent
  console.log('send finished')
}

exports.sendToTwitter = async function (message) {
  try {
    const twitter = new TwitterApi({
      appKey: process.env.TWITTER_ID,
      appSecret: process.env.TWITTER_SECRET,
      accessToken: process.env.TWITTER_API_TOKEN,
      accessSecret: process.env.TWITTER_API_SECRET
    })
    await twitter.v2.tweet(message)
    console.log('tweet sent')
  } catch (err) {
    console.error('sending to twitter', err)
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
    console.error('sending to nostr', err)
  }
}
