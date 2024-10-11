// XXX this is temporary until we have so many subs they have
// to be loaded from the server
export const DEFAULT_SUBS = ['bitcoin', 'nostr', 'tech', 'meta', 'jobs']
export const DEFAULT_SUBS_NO_JOBS = DEFAULT_SUBS.filter(s => s !== 'jobs')

export const PAID_ACTION_TERMINAL_STATES = ['FAILED', 'PAID', 'RETRYING']
export const NOFOLLOW_LIMIT = 1000
export const UNKNOWN_LINK_REL = 'noreferrer nofollow noopener'
export const UPLOAD_SIZE_MAX = 50 * 1024 * 1024
export const UPLOAD_SIZE_MAX_AVATAR = 5 * 1024 * 1024
export const BOOST_MULT = 10000
export const BOOST_MIN = BOOST_MULT
export const IMAGE_PIXELS_MAX = 35000000
// backwards compatibile with old media domain env var and precedence for docker url if set
export const MEDIA_URL = process.env.MEDIA_URL_DOCKER || process.env.NEXT_PUBLIC_MEDIA_URL || `https://${process.env.NEXT_PUBLIC_MEDIA_DOMAIN}`
export const AWS_S3_URL_REGEXP = new RegExp(`${process.env.NEXT_PUBLIC_MEDIA_URL || `https://${process.env.NEXT_PUBLIC_MEDIA_DOMAIN}`}/([0-9]+)`, 'g')
export const UPLOAD_TYPES_ALLOW = [
  'image/gif',
  'image/heic',
  'image/png',
  'image/jpeg',
  'image/webp',
  'video/mp4',
  'video/mpeg',
  'video/webm'
]
export const AVATAR_TYPES_ALLOW = UPLOAD_TYPES_ALLOW.filter(t => t.startsWith('image/'))
export const INVOICE_ACTION_NOTIFICATION_TYPES = ['ITEM_CREATE', 'ZAP', 'DOWN_ZAP', 'POLL_VOTE', 'BOOST']
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
export const SN_ADMIN_IDS = [USER_ID.k00b, USER_ID.ek, USER_ID.sn]
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
export const ITEM_SORTS = ['zaprank', 'comments', 'sats', 'boost']
export const SUB_SORTS = ['stacking', 'revenue', 'spending', 'posts', 'comments']
export const WHENS = ['day', 'week', 'month', 'year', 'forever', 'custom']
export const ITEM_TYPES_USER = ['all', 'posts', 'comments', 'bounties', 'links', 'discussions', 'polls', 'freebies', 'jobs', 'bookmarks']
export const ITEM_TYPES = ['all', 'posts', 'comments', 'bounties', 'links', 'discussions', 'polls', 'freebies', 'bios', 'jobs']
export const ITEM_TYPES_UNIVERSAL = ['all', 'posts', 'comments', 'freebies']
export const OLD_ITEM_DAYS = 3
export const ANON_FEE_MULTIPLIER = 100
export const SSR = typeof window === 'undefined'
export const MAX_FORWARDS = 5
export const LND_PATHFINDING_TIMEOUT_MS = 30000
export const LNURLP_COMMENT_MAX_LENGTH = 1000
export const RESERVED_MAX_USER_ID = 615
export const GLOBAL_SEED = USER_ID.k00b
export const FREEBIE_BASE_COST_THRESHOLD = 10
export const USER_IDS_BALANCE_NO_LIMIT = [...SN_ADMIN_IDS, USER_ID.anon, USER_ID.ad]

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
    op: '+',
    modifier: cost => cost + TERRITORY_COST_MONTHLY
  },
  yearly: {
    term: '+ 1m',
    label: `${labelPrefix} year`,
    op: '+',
    modifier: cost => cost + TERRITORY_COST_YEARLY
  },
  once: {
    term: '+ 3m',
    label: 'one time',
    op: '+',
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

export const FOUND_BLURBS = {
  COWBOY_HAT: [
    'The harsh frontier is no place for the unprepared. This hat will protect you from the sun, dust, and other elements Mother Nature throws your way.',
    'A cowboy is nothing without a cowboy hat. Take good care of it, and it will protect you from the sun, dust, and other elements on your journey.',
    "This is not just a hat, it's a matter of survival. Take care of this essential tool, and it will shield you from the scorching sun and the elements.",
    "A cowboy hat isn't just a fashion statement. It's your last defense against the unforgiving elements of the Wild West. Hang onto it tight.",
    "A good cowboy hat is worth its weight in gold, shielding you from the sun, wind, and dust of the western frontier. Don't lose it.",
    'Your cowboy hat is the key to your survival in the wild west. Treat it with respect and it will protect you from the elements.'
  ],
  GUN: [
    'A gun is a tool, and like all tools, it can be used for good or evil. Use it wisely.',
    'In these wild lands, a gun can be your best friend or worst enemy. Handle it with care and respect.',
    'This firearm is more than just a weapon; it\'s your lifeline in the untamed West. Treat it well.',
    'A gun in the right hands can mean the difference between life and death. Make sure your aim is true.',
    'This gun is your ticket to survival in the frontier. Treat it with care and respect.'
  ],
  HORSE: [
    'A loyal steed is worth its weight in gold. Treat this horse well, and it\'ll carry you through thick and thin.',
    'From dusty trails to raging rivers, this horse will be your constant companion. Treat it with respect.',
    'This horse has chosen you as much as you\'ve chosen it. Together, you\'ll forge a path through the frontier.',
    'Your new horse is both transportation and friend. In the loneliness of the prairie, you\'ll be glad for its company.',
    'Swift hooves and a sturdy back - this horse has the spirit of the West. Ride it with pride and care.'
  ]
}
export const LOST_BLURBS = {
  COWBOY_HAT: [
    'your cowboy hat was taken by the wind storm that blew in from the west. No worries, a true cowboy always finds another hat.',
    "you left your trusty cowboy hat in the saloon before leaving town. You'll need a replacement for the long journey west.",
    'you lost your cowboy hat in a wild shoot-out on the outskirts of town. Tough luck, time to start searching for another one.',
    'you ran out of food and had to trade your hat for supplies. Better start looking for another hat.',
    "your hat was stolen by a mischievous prairie dog. You won't catch the dog, but you can always find another hat.",
    'you lost your hat while crossing the river on your journey west. Maybe you can find a replacement hat in the next town.'
  ],
  GUN: [
    'your gun slipped from its holster while crossing a treacherous ravine. It\'s lost to the depths, but a new one awaits in the next town.',
    'you were forced to toss your gun to distract a grizzly bear. It saved your life, but now you\'ll need to find a new firearm.',
    'your gun was confiscated by the local sheriff after a misunderstanding. Time to clear your name and find a new sidearm.',
    'your trusty six-shooter jammed beyond repair during a shootout. Luckily you survived, but now you need a replacement.',
    'you traded your gun for medicine to save a sick child. A noble deed, but the frontier is unforgiving - best find a new weapon soon.'
  ],
  HORSE: [
    'your horse spooked at a rattlesnake and bolted into the night. You\'ll need to find a new steed to continue your journey.',
    'you lost your horse in a game of chance. The stakes were high, but now you\'re on foot until you can acquire a new mount.',
    'your horse was stolen by bandits while you slept. Time to track down a new companion for the long road ahead.',
    'your loyal steed fell ill and you had to leave it at a ranch to recover. You\'ll need a new horse to press on with your travels.',
    'your horse was requisitioned by the cavalry for an urgent mission. They left you with a voucher, but you\'ll need to find a new mount soon.'
  ]
}

export const ADMIN_ITEMS = [
  // FAQ, old privacy policy, changelog, content guidelines, tos, new privacy policy, copyright policy
  349, 76894, 78763, 81862, 338393, 338369, 338453
]

export const INVOICE_RETENTION_DAYS = 7
export const JIT_INVOICE_TIMEOUT_MS = 180_000

export const FAST_POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_FAST_POLL_INTERVAL)
export const NORMAL_POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_NORMAL_POLL_INTERVAL)
export const LONG_POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_LONG_POLL_INTERVAL)
export const EXTRA_LONG_POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_EXTRA_LONG_POLL_INTERVAL)

export const ZAP_UNDO_DELAY_MS = 5_000
