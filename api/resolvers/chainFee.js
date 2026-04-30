import { cachedFetcher, snFetch } from '@/lib/fetch'

const CHAIN_FEE_URL = process.env.CHAIN_FEE_URL || 'https://mempool.space/api/v1/fees/recommended'

const getChainFeeRate = cachedFetcher(async function fetchChainFeeRate () {
  try {
    const res = await snFetch(CHAIN_FEE_URL)
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
