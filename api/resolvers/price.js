const cache = new Map()
const expiresIn = 30000 // in milliseconds

async function fetchPrice (fiat) {
  const url = `https://api.coinbase.com/v2/prices/BTC-${fiat}/spot`
  const price = await fetch(url)
    .then((res) => res.json())
    .then((body) => parseFloat(body.data.amount))
    .catch((err) => {
      console.error('price', err)
      return -1
    })
  cache.set(fiat, { price, createdAt: Date.now() })
  return price
}

async function getPrice (fiat, fromCache = true) {
  fiat ??= 'USD'

  if (!fromCache) {
    const newPrice = await fetchPrice(fiat)
    return newPrice
  }

  if (cache.has(fiat)) {
    const { price, createdAt } = cache.get(fiat)
    const expired = createdAt + expiresIn < Date.now()
    if (expired) fetchPrice(fiat).catch(console.error)
    return price // serve stale price (this on the SSR critical path)
  } else {
    fetchPrice(fiat).catch(console.error)
    return null
  }
}

export default {
  Query: {
    price: async (parent, { fiatCurrency, fromCache }, ctx) => {
      return await getPrice(fiatCurrency, fromCache)
    }
  }
}
