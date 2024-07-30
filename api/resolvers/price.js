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

async function getPrice (fiat, changedCurrency = false) {
  fiat ??= 'USD'
  if (cache.has(fiat)) {
    const { price, createdAt } = cache.get(fiat)
    const expired = createdAt + expiresIn < Date.now()
    if (expired) {
      if (changedCurrency) {
        const newPrice = await fetchPrice(fiat)
        return newPrice
      } else {
        fetchPrice(fiat).catch(console.error)
      }
    }
    return price
  } else {
    if (changedCurrency) {
      const newPrice = await fetchPrice(fiat)
      return newPrice
    } else {
      fetchPrice(fiat).catch(console.error)
    }
  }
  return null
}

export default {
  Query: {
    price: async (parent, { fiatCurrency, changedCurrency }, ctx) => {
      return await getPrice(fiatCurrency, changedCurrency)
    }
  }
}
