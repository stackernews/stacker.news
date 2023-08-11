// XXX this is temporary until we have so many subs they have
// to be loaded from the server
const SUBS = ['bitcoin', 'nostr', 'tech', 'meta', 'jobs']
const SUBS_NO_JOBS = SUBS.filter(s => s !== 'jobs')

module.exports = {
  NOFOLLOW_LIMIT: 100,
  BOOST_MIN: 5000,
  UPLOAD_SIZE_MAX: 2 * 1024 * 1024,
  IMAGE_PIXELS_MAX: 35000000,
  UPLOAD_TYPES_ALLOW: [
    'image/gif',
    'image/heic',
    'image/png',
    'image/jpeg',
    'image/webp'
  ],
  COMMENT_DEPTH_LIMIT: 10,
  MAX_TITLE_LENGTH: 80,
  MAX_POLL_CHOICE_LENGTH: 30,
  ITEM_SPAM_INTERVAL: '10m',
  ANON_ITEM_SPAM_INTERVAL: '0',
  INV_PENDING_LIMIT: 10,
  BALANCE_LIMIT_MSATS: 1000000000, // 1m sats
  ANON_INV_PENDING_LIMIT: 100,
  ANON_BALANCE_LIMIT_MSATS: 0, // disable
  MAX_POLL_NUM_CHOICES: 10,
  MIN_POLL_NUM_CHOICES: 2,
  ITEM_FILTER_THRESHOLD: 1.2,
  DONT_LIKE_THIS_COST: 1,
  COMMENT_TYPE_QUERY: ['comments', 'freebies', 'outlawed', 'borderland', 'all', 'bookmarks'],
  SUBS,
  SUBS_NO_JOBS,
  USER_SORTS: ['stacked', 'spent', 'comments', 'posts', 'referrals'],
  ITEM_SORTS: ['votes', 'comments', 'sats'],
  WHENS: ['day', 'week', 'month', 'year', 'forever'],
  ITEM_TYPES: context => {
    const items = ['all', 'posts', 'comments', 'bounties', 'links', 'discussions', 'polls']
    if (!context) {
      items.push('bios', 'jobs')
    }
    items.push('freebies')
    if (context === 'user') {
      items.push('jobs', 'bookmarks')
    }
    return items
  },
  OLD_ITEM_DAYS: 3,
  ANON_USER_ID: 27,
  ANON_POST_FEE: 1000,
  ANON_COMMENT_FEE: 100,
  SSR: typeof window === 'undefined'
}
