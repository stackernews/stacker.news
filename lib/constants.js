export const NOFOLLOW_LIMIT = 100
export const BOOST_MIN = 5000
export const UPLOAD_SIZE_MAX = 2 * 1024 * 1024
export const IMAGE_PIXELS_MAX = 35000000
export const UPLOAD_TYPES_ALLOW = [
  'image/gif',
  'image/heic',
  'image/png',
  'image/jpeg',
  'image/webp'
]
export const COMMENT_DEPTH_LIMIT = 10
export const MAX_TITLE_LENGTH = 80
export const MAX_POLL_CHOICE_LENGTH = 30
export const ITEM_SPAM_INTERVAL = '10m'
export const MAX_POLL_NUM_CHOICES = 10
export const MIN_POLL_NUM_CHOICES = 2
export const ITEM_FILTER_THRESHOLD = 1.2
export const DONT_LIKE_THIS_COST = 1
export const COMMENT_TYPE_QUERY = ['comments', 'freebies', 'outlawed', 'borderland', 'all', 'bookmarks']

// XXX this is temporary until we have so many subs they have
// to be loaded from the server
export const SUBS = ['bitcoin', 'nostr', 'tech', 'meta', 'jobs']
export const SUBS_NO_JOBS = SUBS.filter(s => s !== 'jobs')
export const USER_SORTS = ['stacked', 'spent', 'comments', 'posts', 'referrals']
export const ITEM_SORTS = ['votes', 'comments', 'sats']
export const WHENS = ['day', 'week', 'month', 'year', 'forever']

export const ITEM_TYPES = context => {
  if (context === 'jobs') {
    return ['posts', 'comments', 'all', 'freebies']
  }

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
export const SSR = typeof window === 'undefined'
