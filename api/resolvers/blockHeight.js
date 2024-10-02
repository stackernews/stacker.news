import { isServiceEnabled } from '@/lib/sndev'
import { cachedFetcher } from '@/lib/fetch'
import { getHeight } from 'ln-service'

const getBlockHeight = cachedFetcher(async ({ lnd }) => {
  try {
    const { current_block_height: height } = await getHeight({ lnd })
    return height
  } catch (err) {
    console.error('getBlockHeight', err)
    return 0
  }
}, {
  maxSize: 1,
  cacheExpiry: 60 * 1000, // 1 minute
  forceRefreshThreshold: 0
})

export default {
  Query: {
    blockHeight: async (parent, opts, { lnd }) => {
      if (!isServiceEnabled('payments')) return 0
      return await getBlockHeight({ lnd }) || 0
    }
  }
}
