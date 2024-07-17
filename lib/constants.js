// XXX this is temporary until we have so many subs they have
// to be loaded from the server
export const DEFAULT_SUBS = ['bitcoin', 'nostr', 'tech', 'meta', 'jobs']
export const DEFAULT_SUBS_NO_JOBS = DEFAULT_SUBS.filter(s => s !== 'jobs')

export const NOFOLLOW_LIMIT = 1000
export const UNKNOWN_LINK_REL = 'noreferrer nofollow noopener'
export const BOOST_MULT = 5000
export const BOOST_MIN = BOOST_MULT * 10
export const UPLOAD_SIZE_MAX = 25 * 1024 * 1024
export const UPLOAD_SIZE_MAX_AVATAR = 5 * 1024 * 1024
export const IMAGE_PIXELS_MAX = 35000000
// backwards compatibile with old media domain env var and precedence for docker url if set
export const MEDIA_URL = process.env.MEDIA_URL_DOCKER || process.env.NEXT_PUBLIC_MEDIA_URL || `https://${process.env.NEXT_PUBLIC_MEDIA_DOMAIN}`
export const AWS_S3_URL_REGEXP = new RegExp(`${process.env.NEXT_PUBLIC_MEDIA_URL || `https://${process.env.NEXT_PUBLIC_MEDIA_DOMAIN}`}/([0-9]+)`, 'g')
export const UPLOAD_TYPES_ALLOW = [
  'image/gif',
  'image/heic',
  'image/png',
  'image/jpeg',
  'image/webp'
]
export const INVOICE_ACTION_NOTIFICATION_TYPES = ['ITEM_CREATE', 'ZAP', 'DOWN_ZAP', 'POLL_VOTE']
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
export const BALANCE_LIMIT_MSATS = 100000000 // 100k sat
export const USER_ID = {
  k00b: 616,
  ek: 6030,
  sn: 4502,
  anon: 27,
  ad: 9,
  delete: 106,
  saloon: 17226
}
export const SN_USER_IDS = [USER_ID.k00b, USER_ID.ek, USER_ID.sn]
export const SN_NO_REWARDS_IDS = [USER_ID.anon, USER_ID.sn, USER_ID.saloon]
export const ANON_INV_PENDING_LIMIT = 1000
export const ANON_BALANCE_LIMIT_MSATS = 0 // disable
export const MAX_POLL_NUM_CHOICES = 10
export const MIN_POLL_NUM_CHOICES = 2
export const POLL_COST = 1
export const ITEM_FILTER_THRESHOLD = 1.2
export const DONT_LIKE_THIS_COST = 1
export const COMMENT_TYPE_QUERY = ['comments', 'freebies', 'outlawed', 'borderland', 'all', 'bookmarks']
export const USER_SORTS = ['value', 'stacking', 'spending', 'comments', 'posts', 'referrals']
export const ITEM_SORTS = ['zaprank', 'comments', 'sats']
export const SUB_SORTS = ['stacking', 'revenue', 'spending', 'posts', 'comments']
export const WHENS = ['day', 'week', 'month', 'year', 'forever', 'custom']
export const ITEM_TYPES_USER = ['all', 'posts', 'comments', 'bounties', 'links', 'discussions', 'polls', 'freebies', 'jobs', 'bookmarks']
export const ITEM_TYPES = ['all', 'posts', 'comments', 'bounties', 'links', 'discussions', 'polls', 'freebies', 'bios', 'jobs']
export const ITEM_TYPES_UNIVERSAL = ['all', 'posts', 'comments', 'freebies']
export const OLD_ITEM_DAYS = 3
export const ANON_FEE_MULTIPLIER = 100
export const SSR = typeof window === 'undefined'
export const MAX_FORWARDS = 5
export const LNURLP_COMMENT_MAX_LENGTH = 1000
export const RESERVED_MAX_USER_ID = 615
export const GLOBAL_SEED = USER_ID.k00b
export const FREEBIE_BASE_COST_THRESHOLD = 10
export const USER_IDS_BALANCE_NO_LIMIT = [...SN_USER_IDS, USER_ID.anon, USER_ID.ad]

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

export const TERRITORY_PERIOD_COST = (billingType) => {
  switch (billingType.toUpperCase()) {
    case 'MONTHLY':
      return TERRITORY_COST_MONTHLY
    case 'YEARLY':
      return TERRITORY_COST_YEARLY
    case 'ONCE':
      return TERRITORY_COST_ONCE
  }
}

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
export const JIT_INVOICE_TIMEOUT_MS = 180_000

export const FAST_POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_FAST_POLL_INTERVAL)
export const NORMAL_POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_NORMAL_POLL_INTERVAL)
export const LONG_POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_LONG_POLL_INTERVAL)
export const EXTRA_LONG_POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_EXTRA_LONG_POLL_INTERVAL)

// attached wallets
export const Wallet = {
  LND: { logTag: 'lnd', server: true, type: 'LND', field: 'walletLND' },
  CLN: { logTag: 'cln', server: true, type: 'CLN', field: 'walletCLN' },
  LnAddr: { logTag: 'lnAddr', server: true, type: 'LIGHTNING_ADDRESS', field: 'walletLightningAddress' },
  NWC: { logTag: 'nwc', server: false },
  LNbits: { logTag: 'lnbits', server: false },
  LNC: { logTag: 'lnc', server: false }
}

export const getWalletBy = (key, value) => {
  for (const w of Object.values(Wallet)) {
    if (w[key] === value) return w
  }
  throw new Error(`wallet not found: ${key}=${value}`)
}

export const ZAP_UNDO_DELAY_MS = 5_000
