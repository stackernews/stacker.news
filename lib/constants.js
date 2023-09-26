// XXX this is temporary until we have so many subs they have
// to be loaded from the server
export const SUBS = ['bitcoin', 'nostr', 'tech', 'meta', 'jobs']
export const SUBS_NO_JOBS = SUBS.filter(s => s !== 'jobs')

export const NOFOLLOW_LIMIT = 100
export const BOOST_MULT = 5000
export const BOOST_MIN = BOOST_MULT * 5
export const UPLOAD_SIZE_MAX = 2 * 1024 * 1024
export const IMAGE_PIXELS_MAX = 35000000
export const UPLOAD_TYPES_ALLOW = [
  'image/gif',
  'image/heic',
  'image/png',
  'image/jpeg',
  'image/webp'
]
export const COMMENT_DEPTH_LIMIT = 8
export const MAX_TITLE_LENGTH = 80
export const MAX_POLL_CHOICE_LENGTH = 40
export const ITEM_SPAM_INTERVAL = '10m'
export const ANON_ITEM_SPAM_INTERVAL = '0'
export const INV_PENDING_LIMIT = 10
export const BALANCE_LIMIT_MSATS = 1000000000 // 1m sat
export const ANON_INV_PENDING_LIMIT = 100
export const ANON_BALANCE_LIMIT_MSATS = 0 // disabl
export const MAX_POLL_NUM_CHOICES = 10
export const MIN_POLL_NUM_CHOICES = 2
export const POLL_COST = 1
export const ITEM_FILTER_THRESHOLD = 1.2
export const DONT_LIKE_THIS_COST = 1
export const COMMENT_TYPE_QUERY = ['comments', 'freebies', 'outlawed', 'borderland', 'all', 'bookmarks']
export const USER_SORTS = ['stacked', 'spent', 'comments', 'posts', 'referrals']
export const ITEM_SORTS = ['zaprank', 'comments', 'sats']
export const WHENS = ['day', 'week', 'month', 'year', 'forever']
export const ITEM_TYPES = context => {
  const items = ['all', 'posts', 'comments', 'bounties', 'links', 'discussions', 'polls']
  if (!context) {
    items.push('bios', 'jobs')
  }
  items.push('freebies')
  if (context === 'user') {
    items.push('jobs', 'bookmarks')
  }
  return items
}
export const OLD_ITEM_DAYS = 3
export const ANON_USER_ID = 27
export const AD_USER_ID = 9
export const ANON_POST_FEE = 1000
export const ANON_COMMENT_FEE = 100
export const SSR = typeof window === 'undefined'
export const MAX_FORWARDS = 5
export const LNURLP_COMMENT_MAX_LENGTH = 1000
