import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { cachedFetcher } from '@/lib/fetch'

const getPrice = cachedFetcher(async (fiat = 'USD') => {
  const url = `https://api.coinbase.com/v2/prices/BTC-${fiat}/spot`
  try {
    const res = await fetch(url)
    const body = await res.json()
    return parseFloat(body.data.amount)
  } catch (err) {
    console.error(err)
    return -1
  }
}, {
  maxSize: SUPPORTED_CURRENCIES.length,
  cacheExpiry: 60 * 1000, // 1 minute
  forceRefreshThreshold: 0, // never force refresh
  keyGenerator: (fiat = 'USD') => fiat
})

export default {
  Query: {
    price: async (parent, { fiatCurrency }, ctx) => {
      return await getPrice(fiatCurrency) || -1
    }
  }
}
