import Nostr from '@/lib/nostr'
import { TwitterApi } from 'twitter-api-v2'

// Initialize Twitter client
const client = new TwitterApi({
  appKey: process.env.TWITTER_POSTER_API_KEY,
  appSecret: process.env.TWITTER_POSTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_POSTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_POSTER_ACCESS_TOKEN_SECRET
})

async function postToTwitter ({ message }) {
  try {
    await client.appLogin()
    await client.v2.tweet(message)
    console.log('Successfully posted to Twitter')
  } catch (err) {
    console.error('Error posting to Twitter:', err)
  }
}

const RELAYS = [
  'wss://nos.lol/',
  'wss://nostr.land/',
  'wss://nostr.wine/',
  'wss://purplerelay.com/',
  'wss://relay.damus.io/',
  'wss://relay.snort.social/',
  'wss://relay.nostr.band/',
  'wss://relay.primal.net/'
]

async function postToNostr ({ message }) {
  const nostr = Nostr.get()
  const signer = nostr.getSigner({ privKey: process.env.NOSTR_POSTER_PRIVATE_KEY })
  try {
    await nostr.publish({
      created_at: Math.floor(new Date().getTime() / 1000),
      content: message,
      tags: [],
      kind: 1
    }, {
      relays: RELAYS,
      signer,
      timeout: 5000
    })
  } catch (err) {
    console.error('Error posting to Nostr:', err)
  }
}

export async function postToSocial () {
  // await postToTwitter({ message: 'Hello, world! ... testing' })
  // await postToNostr({ message: 'Hello, world! ... testing' })
}
