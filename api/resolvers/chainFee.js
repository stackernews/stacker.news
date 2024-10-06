import { cachedFetcher } from '@/lib/fetch'

const getChainFeeRate = cachedFetcher(async () => {
  const url = 'https://mempool.space/api/v1/fees/recommended'
  try {
    const res = await fetch(url)
    const body = await res.json()
    return body.hourFee
  } catch (err) {
    console.error('fetchChainFee', err)
    return 0
  }
}, {
  maxSize: 1,
  cacheExpiry: 60 * 1000, // 1 minute
  forceRefreshThreshold: 0, // never force refresh
  keyGenerator: () => 'getChainFeeRate'
})

export default {
  Query: {
    chainFee: async (parent, opts, ctx) => {
      return await getChainFeeRate() || 0
    }
  }
}
