const cache = new Map()
const expiresIn = 1000 * 30 // 30 seconds in milliseconds

async function fetchChainFeeRate () {
  const url = 'https://mempool.space/api/v1/fees/recommended'
  const chainFee = await fetch(url)
    .then((res) => res.json())
    .then((body) => body.hourFee)
    .catch((err) => {
      console.error('fetchChainFee', err)
      return 0
    })

  cache.set('fee', { fee: chainFee, createdAt: Date.now() })
  return chainFee
}

async function getChainFeeRate () {
  if (cache.has('fee')) {
    const { fee, createdAt } = cache.get('fee')
    const expired = createdAt + expiresIn < Date.now()
    if (expired) fetchChainFeeRate().catch(console.error) // update cache
    return fee
  } else {
    fetchChainFeeRate().catch(console.error)
  }
  return 0
}

export default {
  Query: {
    chainFee: async (parent, opts, ctx) => {
      return await getChainFeeRate()
    }
  }
}
