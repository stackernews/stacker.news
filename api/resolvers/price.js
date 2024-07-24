const cache = new Map()
const expiresIn = 30000 // in milliseconds

async function fetchPrice (fiat) {
  const url = `https://api.coinbase.com/v2/prices/BTC-${fiat}/spot`
  const price = await fetch(url)
    .then((res) => res.json())
    .then((body) => parseFloat(body.data.amount))
    .catch((err) => {
      console.error(err)
      return -1
    })
  cache.set(fiat, { price, createdAt: Date.now() })
  return price
}

async function getPrice (fiat) {
  fiat ??= 'USD'
  if (cache.has(fiat)) {
    const { price, createdAt } = cache.get(fiat)
    const expired = createdAt + expiresIn < Date.now()
    if (expired) {
      const newPrice = await fetchPrice(fiat);
      return newPrice;
    } else {
      return price;
    }
  } else {
    const newPrice = await fetchPrice(fiat);
    return newPrice;
  }
}

export default {
  Query: {
    price: async (parent, { fiatCurrency }, ctx) => {
      return await getPrice(fiatCurrency)
    }
  }
}
