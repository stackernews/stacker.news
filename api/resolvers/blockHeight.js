import { isServiceEnabled } from '@/lib/sndev'
import { cachedFetcher, snFetch } from '@/lib/fetch'
import { getHeight } from 'ln-service'
import { isLndMaintenance } from '@/api/lnd/maintenance'

const getLndBlockHeight = cachedFetcher(async function fetchLndBlockHeight ({ lnd }) {
  try {
    const { current_block_height: height } = await getHeight({ lnd })
    return height
  } catch (err) {
    console.error('getLndBlockHeight', err)
    return 0
  }
}, {
  maxSize: 1,
  cacheExpiry: 60 * 1000, // 1 minute
  forceRefreshThreshold: 0,
  keyGenerator: () => 'getLndBlockHeight'
})

const getPublicBlockHeight = cachedFetcher(async function fetchPublicBlockHeight () {
  try {
    const res = await snFetch('https://mempool.space/api/blocks/tip/height')
    if (!res.ok) throw new Error(`mempool.space returned ${res.status}`)

    const height = Number(await res.text())
    if (!Number.isSafeInteger(height) || height <= 0) {
      throw new Error('mempool.space returned an invalid block height')
    }

    return height
  } catch (err) {
    console.error('getPublicBlockHeight', err)
    return 0
  }
}, {
  maxSize: 1,
  cacheExpiry: 60 * 1000, // 1 minute
  forceRefreshThreshold: 0,
  keyGenerator: () => 'getPublicBlockHeight'
})

export default {
  Query: {
    blockHeight: async (parent, opts, { lnd }) => {
      if (isServiceEnabled('payments') && !isLndMaintenance()) {
        const height = await getLndBlockHeight({ lnd })
        if (height) return height
      }

      return await getPublicBlockHeight() || 0
    }
  }
}
