import { snFetch } from '@/lib/fetch'
import { assertResponseOk } from '@/lib/url'
import { embedAvatar, embedPicture } from '@/lib/imgproxy'

const X_URL = 'https://x.com'
const SYNDICATION_URL = 'https://cdn.syndication.twimg.com'
// use the best mp4 up to 2.5 Mbps, about 720p on X
const MAX_VIDEO_BITRATE = 2_500_000

// the token X's embed widget computes from the tweet id, the same formula react-tweet uses
const emulateTwitterToken = id => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '')

/** fetches a tweet from the API that X's embed widget uses */
export async function fetchTweet (id) {
  const params = new URLSearchParams({ id, lang: 'en', token: emulateTwitterToken(id) })
  const res = await snFetch(`${SYNDICATION_URL}/tweet-result?${params}`, { timeout: 5000 })
  if (res.status === 404 || res.status === 400) return null
  assertResponseOk(res)
  return await res.json()
}

/** converts a raw tweet to embed data, null for a tombstone */
export function normalizeTweet (tweet) {
  // restricted tweets (and maybe deleted ones) are returned as TweetTombstone
  if (tweet.__typename !== 'Tweet') return null

  const quoted = tweet.quoted_tweet
  return {
    ...post(tweet, quoted?.id_str),
    quote: quoted && post(quoted)
  }
}

function post (tweet, quotedId) {
  const { user } = tweet
  const href = `${X_URL}/${user.screen_name}/status/${tweet.id_str}`
  const text = segments(tweet, quotedId)

  // the text of long tweets is cut at 280 characters
  if (tweet.note_tweet) text.push({ text: '… ' }, { text: 'show more', href })
  if (tweet.card?.name?.startsWith('poll')) text.push({ text: '\n\n' }, { text: 'see the poll on X', href })

  return {
    href,
    createdAt: tweet.created_at,
    author: {
      name: user.name,
      handle: `@${user.screen_name}`,
      href: `${X_URL}/${user.screen_name}`,
      // _normal is 48px, too small for 2x screens
      avatar: embedAvatar(user.profile_image_url_https.replace('_normal.', '_200x200.'))
    },
    replyTo: tweet.in_reply_to_screen_name && {
      text: `@${tweet.in_reply_to_screen_name}`,
      href: `${X_URL}/${tweet.in_reply_to_screen_name}`
    },
    text,
    media: (tweet.mediaDetails ?? []).map(media).filter(m => m.src),
    preview: preview(tweet)
  }
}

// the only characters X escapes in tweet text
const decodeEntities = text => text
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')

// link target for each entity type
const ENTITY_HREF = {
  hashtags: entity => `${X_URL}/hashtag/${encodeURIComponent(entity.text)}`,
  user_mentions: entity => `${X_URL}/${entity.screen_name}`,
  symbols: entity => `${X_URL}/search?q=%24${encodeURIComponent(entity.text)}`,
  urls: entity => entity.expanded_url
}

// splits the tweet text into plain text and links
function segments (tweet, quotedId) {
  // entity indices are in code points, not UTF-16 units, so we can't slice the string directly
  const chars = Array.from(tweet.text)
  const slice = (from, to) => decodeEntities(chars.slice(from, to).join(''))

  const links = []
  for (const [kind, href] of Object.entries(ENTITY_HREF)) {
    for (const entity of tweet.entities[kind] ?? []) {
      const [from, to] = entity.indices
      // urls show their display_url, other entities show their own text
      links.push({ from, to, href: href(entity), text: entity.display_url ?? slice(from, to) })
    }
  }
  links.sort((a, b) => a.from - b.from)

  // display_text_range[0] skips the @handles a reply starts with.
  // display_text_range[1] is wrong for some tweets with emoji, so we end at the first media link instead
  const [start] = tweet.display_text_range
  const end = tweet.entities.media?.[0]?.indices[0] ?? chars.length
  // the quoted tweet is shown below the text, so we skip the link to it
  const isQuote = href => quotedId && href.includes(`/status/${quotedId}`)

  const result = []
  let cursor = start
  for (const { from, to, href, text } of links) {
    if (from < cursor || to > end) continue
    if (from > cursor) result.push({ text: slice(cursor, from) })
    if (!isQuote(href)) result.push({ text, href })
    cursor = to
  }
  if (end > cursor) result.push({ text: slice(cursor, end) })

  // trim the whitespace left by the removed media and quote links
  const last = result.at(-1)
  if (last && !last.href) last.text = last.text.trimEnd()
  return result.filter(segment => segment.text)
}

function media (detail) {
  const picture = {
    ...embedPicture(detail.media_url_https),
    width: detail.original_info.width,
    height: detail.original_info.height,
    alt: detail.ext_alt_text
  }
  if (detail.type === 'photo') return picture

  // for videos and gifs, the picture is the poster
  const mp4s = detail.video_info.variants
    .filter(v => v.content_type === 'video/mp4')
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))
  const mp4 = mp4s.find(v => (v.bitrate ?? 0) <= MAX_VIDEO_BITRATE) ?? mp4s.at(-1)
  return { ...picture, video: mp4?.url, loop: detail.type === 'animated_gif' }
}

// link preview of a tweet, X calls it a card
function preview (tweet) {
  const values = tweet.card?.binding_values
  if (!values?.title) return null

  const image = values.thumbnail_image_original?.image_value
  return {
    // tweet.card.url is a t.co link, the expanded url is in tweet.entities.urls
    href: tweet.entities.urls?.find(u => u.url === tweet.card.url)?.expanded_url ?? tweet.card.url,
    title: values.title.string_value,
    domain: values.domain?.string_value,
    image: image && embedPicture(image.url)
  }
}
