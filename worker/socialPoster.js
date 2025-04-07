import Nostr from '@/lib/nostr'
import { TwitterApi } from 'twitter-api-v2'
import { msatsToSats, numWithUnits } from '@/lib/format'

const isProd = process.env.NODE_ENV === 'production'

async function postToTwitter ({ message }) {
  if (!isProd ||
    !process.env.TWITTER_POSTER_API_KEY ||
    !process.env.TWITTER_POSTER_API_KEY_SECRET ||
    !process.env.TWITTER_POSTER_ACCESS_TOKEN ||
    !process.env.TWITTER_POSTER_ACCESS_TOKEN_SECRET) {
    console.log('Twitter poster not configured')
    return
  }

  try {
    const client = new TwitterApi({
      appKey: process.env.TWITTER_POSTER_API_KEY,
      appSecret: process.env.TWITTER_POSTER_API_KEY_SECRET,
      accessToken: process.env.TWITTER_POSTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_POSTER_ACCESS_TOKEN_SECRET
    })
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
  if (!isProd || !process.env.NOSTR_PRIVATE_KEY) {
    console.log('Nostr poster not configured')
    return
  }

  const nostr = Nostr.get()
  const signer = nostr.getSigner({ privKey: process.env.NOSTR_PRIVATE_KEY })
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

async function getHottestItem ({ models }) {
  const item = await models.$queryRaw`
    SELECT "Item".*, users.name as "userName"
    FROM "Item"
    JOIN hot_score_view ON "Item"."id" = hot_score_view.id
    JOIN users ON "Item"."userId" = users.id
    LEFT JOIN "AutoSocialPost" ON "Item"."id" = "AutoSocialPost"."itemId"
    WHERE "AutoSocialPost"."id" IS NULL
    AND "Item"."parentId" IS NULL
    AND NOT "Item".bio
    AND "Item"."deletedAt" IS NULL
    ORDER BY "hot_score_view"."hot_score" DESC
    LIMIT 1`

  if (item.length === 0) {
    console.log('No item to post')
    return null
  }

  await models.AutoSocialPost.create({
    data: {
      itemId: item[0].id
    }
  })

  return item[0]
}

async function itemToMessage ({ item }) {
  return `${item.title}

by ${item.userName} in ~${item.subName}
${numWithUnits(msatsToSats(item.msats), { abbreviate: false })} and ${numWithUnits(item.ncomments, { abbreviate: false, unitSingular: 'comment', unitPlural: 'comments' })} so far

https://stacker.news/items/${item.id}`
}

export async function postToSocial ({ models }) {
  const item = await getHottestItem({ models })
  if (item) {
    const message = await itemToMessage({ item })
    console.log('Message:', message)
    await postToTwitter({ message })
    await postToNostr({ message })
  }
}
