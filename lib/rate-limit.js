import LRU from 'lru-cache'

export default function rateLimit (options) {
  const tokenCache = new LRU({
    max: options.max || 500,
    ttl: options.windowMs || 60 * 1000
  })

  return (req, res) => {
    const token = options.keyGenerator(req, res)
    const limit = options.max

    let tokenCount = tokenCache.get(token) || 0
    tokenCount += 1
    tokenCache.set(token, tokenCount)

    const currentUsage = tokenCount
    const isRateLimited = currentUsage >= limit
    res.setHeader('X-RateLimit-Limit', limit)
    res.setHeader('X-RateLimit-Remaining', isRateLimited ? 0 : limit - currentUsage)

    if (isRateLimited) {
      throw new Error('Too many requests')
    }
  }
}
