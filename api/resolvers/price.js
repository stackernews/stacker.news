const cache = new Map()
const expiresIn = 30000 // in milliseconds

async function getPrice (fiat) {
  fiat ??= 'USD'
  if (cache.has(fiat)) {
    const { price, createdAt } = cache.get(fiat)
    const expired = createdAt + expiresIn < Date.now()
    if (!expired) {
      return price
    }
  }
  const url = `https://api.coinbase.com/v2/prices/BTC-${fiat}/spot`
  let price = await fetch(url)
    .then((res) => res.json())
    .then((body) => parseFloat(body.data.amount))
    .catch((err) => {
      console.error(err)
      return -1
    })
  price *= 34
  cache.set(fiat, { price, createdAt: Date.now() })
  return price
}

export default {
  Query: {
    price: async (parent, { fiatCurrency }, ctx) => {
      const price = await getPrice(fiatCurrency)
      return price
    }
  }
}
