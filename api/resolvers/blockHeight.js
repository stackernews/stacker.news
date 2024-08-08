import lndService from 'ln-service'
import lnd from '@/api/lnd'
import { isServiceEnabled } from '@/lib/sndev'

const cache = new Map()
const expiresIn = 1000 * 30 // 30 seconds in milliseconds

async function fetchBlockHeight () {
  let blockHeight = 0
  if (!isServiceEnabled('payments')) return blockHeight
  try {
    const height = await lndService.getHeight({ lnd })
    blockHeight = height.current_block_height
    cache.set('block', { height: blockHeight, createdAt: Date.now() })
  } catch (err) {
    console.error('fetchBlockHeight', err)
  }
  return blockHeight
}

async function getBlockHeight () {
  if (cache.has('block')) {
    const { height, createdAt } = cache.get('block')
    const expired = createdAt + expiresIn < Date.now()
    if (expired) fetchBlockHeight().catch(console.error) // update cache
    return height // serve stale block height (this on the SSR critical path)
  } else {
    fetchBlockHeight().catch(console.error)
  }
  return 0
}

export default {
  Query: {
    blockHeight: async (parent, opts, ctx) => {
      return await getBlockHeight()
    }
  }
}
