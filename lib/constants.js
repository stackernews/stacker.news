// XXX this is temporary until we have so many subs they have
// to be loaded from the server
export const DEFAULT_SUBS = ['bitcoin', 'nostr', 'tech', 'meta', 'jobs']
export const DEFAULT_SUBS_NO_JOBS = DEFAULT_SUBS.filter(s => s !== 'jobs')

export const NOFOLLOW_LIMIT = 1000
export const BOOST_MULT = 5000
export const BOOST_MIN = BOOST_MULT * 5
export const UPLOAD_SIZE_MAX = 25 * 1024 * 1024
export const UPLOAD_SIZE_MAX_AVATAR = 5 * 1024 * 1024
export const IMAGE_PIXELS_MAX = 35000000
export const AWS_S3_URL_REGEXP = new RegExp(`https://${process.env.NEXT_PUBLIC_MEDIA_DOMAIN}/([0-9]+)`, 'g')
export const UPLOAD_TYPES_ALLOW = [
  'image/gif',
  'image/heic',
  'image/png',
  'image/jpeg',
  'image/webp'
]
export const BOUNTY_MIN = 1000
export const BOUNTY_MAX = 10000000
export const POST_TYPES = ['LINK', 'DISCUSSION', 'BOUNTY', 'POLL']
export const TERRITORY_BILLING_TYPES = ['MONTHLY', 'YEARLY', 'ONCE']
export const TERRITORY_GRACE_DAYS = 5
export const COMMENT_DEPTH_LIMIT = 8
export const MAX_TITLE_LENGTH = 80
export const MIN_TITLE_LENGTH = 5
export const MAX_POST_TEXT_LENGTH = 100000 // 100k
export const MAX_COMMENT_TEXT_LENGTH = 10000 // 10k
export const MAX_TERRITORY_DESC_LENGTH = 1000 // 1k
export const MAX_POLL_CHOICE_LENGTH = 40
export const ITEM_SPAM_INTERVAL = '10m'
export const ANON_ITEM_SPAM_INTERVAL = '0'
export const INV_PENDING_LIMIT = 100
export const BALANCE_LIMIT_MSATS = 250000000 // 250k sat
export const SN_USER_IDS = [616, 6030, 946, 4502]
export const ANON_INV_PENDING_LIMIT = 1000
export const ANON_BALANCE_LIMIT_MSATS = 0 // disable
export const MAX_POLL_NUM_CHOICES = 10
export const MIN_POLL_NUM_CHOICES = 2
export const POLL_COST = 1
export const ITEM_FILTER_THRESHOLD = 1.2
export const DONT_LIKE_THIS_COST = 1
export const COMMENT_TYPE_QUERY = ['comments', 'freebies', 'outlawed', 'borderland', 'all', 'bookmarks']
export const USER_SORTS = ['stacked', 'spent', 'comments', 'posts', 'referrals']
export const ITEM_SORTS = ['zaprank', 'comments', 'sats']
export const WHENS = ['day', 'week', 'month', 'year', 'forever', 'custom']
export const ITEM_TYPES_USER = ['all', 'posts', 'comments', 'bounties', 'links', 'discussions', 'polls', 'freebies', 'jobs', 'bookmarks']
export const ITEM_TYPES = ['all', 'posts', 'comments', 'bounties', 'links', 'discussions', 'polls', 'freebies', 'bios', 'jobs']
export const ITEM_TYPES_UNIVERSAL = ['all', 'posts', 'comments', 'freebies']
export const OLD_ITEM_DAYS = 3
export const ANON_USER_ID = 27
export const DELETE_USER_ID = 106
export const AD_USER_ID = 9
export const ANON_FEE_MULTIPLIER = 100
export const SSR = typeof window === 'undefined'
export const MAX_FORWARDS = 5
export const LNURLP_COMMENT_MAX_LENGTH = 1000
export const RESERVED_MAX_USER_ID = 615
export const GLOBAL_SEED = 616
export const FREEBIE_BASE_COST_THRESHOLD = 10
export const USER_IDS_BALANCE_NO_LIMIT = [...SN_USER_IDS, AD_USER_ID]

// WIP ultimately subject to this list: https://ofac.treasury.gov/sanctions-programs-and-country-information
// From lawyers: north korea, cuba, iran, ukraine, syria
export const SANCTIONED_COUNTRY_CODES = ['KP', 'CU', 'IR', 'UA', 'SY']

export const TERRITORY_COST_MONTHLY = 100000
export const TERRITORY_COST_YEARLY = 1000000
export const TERRITORY_COST_ONCE = 3000000

export const TERRITORY_BILLING_OPTIONS = (labelPrefix) => ({
  monthly: {
    term: '+ 100k',
    label: `${labelPrefix} month`,
    modifier: cost => cost + TERRITORY_COST_MONTHLY
  },
  yearly: {
    term: '+ 1m',
    label: `${labelPrefix} year`,
    modifier: cost => cost + TERRITORY_COST_YEARLY
  },
  once: {
    term: '+ 3m',
    label: 'one time',
    modifier: cost => cost + TERRITORY_COST_ONCE
  }
})

export const FOUND_BLURBS = [
  'The harsh frontier is no place for the unprepared. This hat will protect you from the sun, dust, and other elements Mother Nature throws your way.',
  'A cowboy is nothing without a cowboy hat. Take good care of it, and it will protect you from the sun, dust, and other elements on your journey.',
  "This is not just a hat, it's a matter of survival. Take care of this essential tool, and it will shield you from the scorching sun and the elements.",
  "A cowboy hat isn't just a fashion statement. It's your last defense against the unforgiving elements of the Wild West. Hang onto it tight.",
  "A good cowboy hat is worth its weight in gold, shielding you from the sun, wind, and dust of the western frontier. Don't lose it.",
  'Your cowboy hat is the key to your survival in the wild west. Treat it with respect and it will protect you from the elements.'
]
export const LOST_BLURBS = [
  'your cowboy hat was taken by the wind storm that blew in from the west. No worries, a true cowboy always finds another hat.',
  "you left your trusty cowboy hat in the saloon before leaving town. You'll need a replacement for the long journey west.",
  'you lost your cowboy hat in a wild shoot-out on the outskirts of town. Tough luck, tIme to start searching for another one.',
  'you ran out of food and had to trade your hat for supplies. Better start looking for another hat.',
  "your hat was stolen by a mischievous prairie dog. You won't catch the dog, but you can always find another hat.",
  'you lost your hat while crossing the river on your journey west. Maybe you can find a replacement hat in the next town.'
]

export const ITEM_ALLOW_EDITS = [
  // FAQ, old privacy policy, changelog, content guidelines, tos, new privacy policy, copyright policy
  349, 76894, 78763, 81862, 338393, 338369, 338453
]

export const INVOICE_RETENTION_DAYS = 7
