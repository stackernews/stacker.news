const cache = new Map()
const expiresIn = 30000 // in milliseconds

async function fetchBlockHeight () {
  const url = 'https://mempool.space/api/blocks/tip/height'
  const blockHeight = await fetch(url)
    .then(res => res.text())
    .then((body) => Number(body))
    .catch((err) => {
      console.error(err)
      return 0
    })
  cache.set('block', { height: blockHeight, createdAt: Date.now() })
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
  return null
}

export default {
  Query: {
    blockHeight: async (parent, opts, ctx) => {
      return await getBlockHeight()
    }
  }
}
