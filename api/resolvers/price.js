import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { cachedFetcher } from '@/lib/fetch'

const getPrice = cachedFetcher(async function fetchPrice (fiat = 'USD') {
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

const getBigMacPrice = cachedFetcher(async function fetchBigMacPrice () {
  const csvUrl = 'https://raw.githubusercontent.com/TheEconomist/big-mac-data/master/output-data/big-mac-raw-index.csv'
  try {
    const res = await fetch(csvUrl)
    const csvText = await res.text()
    const lines = csvText.split('\n')
    const usaEntries = lines
      .filter(line => line.includes(',USA,USD,'))
      .map(line => {
        const cols = line.split(',')
        return {
          date: cols[0],
          price: parseFloat(cols[4])
        }
      })
      .filter(entry => !isNaN(entry.price))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    return usaEntries[0]?.price || 5.79
  } catch (err) {
    console.error('Big Mac price fetch error:', err)
    return 5.79
  }
}, {
  maxSize: 1,
  cacheExpiry: 24 * 60 * 60 * 1000,
  forceRefreshThreshold: 0,
  keyGenerator: () => 'bigmac-usd'
})

export default {
  Query: {
    price: async (parent, { fiatCurrency }, ctx) => {
      return await getPrice(fiatCurrency) || -1
    },
    bigMacPrice: async () => {
      return await getBigMacPrice() || 5.79
    }
  }
}
