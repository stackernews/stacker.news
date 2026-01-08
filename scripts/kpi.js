const { ApolloClient, InMemoryCache, HttpLink, gql } = require('@apollo/client')
const fetch = require('cross-fetch')

// Configuration
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'http://localhost:3000/api/graphql'
const PLAUSIBLE_API_KEY = process.env.PLAUSIBLE_API_KEY

// Territory profitability threshold (in sats)
const TERRITORY_PROFIT_THRESHOLD = 50000

// Apollo Client setup
const client = new ApolloClient({
  link: new HttpLink({
    uri: GRAPHQL_ENDPOINT,
    fetch
  }),
  cache: new InMemoryCache(),
  defaultOptions: {
    query: {
      fetchPolicy: 'no-cache'
    }
  }
})

// GraphQL queries
const GROWTH_TOTALS_QUERY = gql`
  query GrowthTotals($when: String, $from: String, $to: String, $sub: String) {
    growthTotals(when: $when, from: $from, to: $to, sub: $sub) {
      spending
      stacking
      items
      registrations
    }
    spendingGrowth(when: $when, from: $from, to: $to, sub: $sub) {
      time
      data {
        name
        value
      }
    }
    spenderGrowth(when: $when, from: $from, to: $to, sub: $sub) {
      time
      data {
        name
        value
      }
    }
  }
`

// Territory payment types that represent SN revenue
const TERRITORY_REVENUE_TYPES = ['TERRITORY_BILLING', 'TERRITORY_CREATE', 'TERRITORY_UPDATE', 'TERRITORY_UNARCHIVE']

const TOP_SUBS_QUERY = gql`
  query TopSubs($when: String, $from: String, $to: String, $by: String) {
    topSubs(when: $when, from: $from, to: $to, by: $by, limit: 200) {
      subs {
        name
        status
        optional {
          revenue(when: $when, from: $from, to: $to)
        }
      }
    }
  }
`

// Utility functions
function formatNumber (num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'm'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
}

function formatSats (sats) {
  return formatNumber(sats) + ' sats'
}

function calculatePercentChange (current, previous) {
  if (previous === 0) return current > 0 ? '+∞' : '0%'
  const change = ((current - previous) / previous) * 100
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(1)}%`
}

function formatMonth (monthStr) {
  // monthStr format: "2025-07"
  const [year, month] = monthStr.split('-')
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ]
  return `${monthNames[parseInt(month) - 1]} ${year}`
}

// Get the list of months to query (complete months only)
function getMonthsToQuery (monthsBack) {
  const months = []
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-indexed

  // Start from the previous month (most recent complete month)
  // and go back monthsBack months, plus 1 extra for comparison
  for (let i = 0; i < monthsBack + 1; i++) {
    let targetMonth = currentMonth - 1 - i
    let targetYear = currentYear

    while (targetMonth < 0) {
      targetMonth += 12
      targetYear -= 1
    }

    const monthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`
    months.unshift(monthStr) // Add to beginning to keep chronological order
  }

  return months
}

// Get date range for a month
function getMonthDateRange (monthStr) {
  const [year, month] = monthStr.split('-').map(Number)
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59, 999)
  return {
    from: startDate.getTime().toString(),
    to: endDate.getTime().toString(),
    startDateStr: startDate.toISOString().slice(0, 10),
    endDateStr: endDate.toISOString().slice(0, 10)
  }
}

async function generateKPISummary (monthsBack = 6) {
  try {
    console.log(`\n# Stacker News KPI Summary (Last ${monthsBack} months)\n`)

    const now = new Date()
    console.log('Current date:', now.toISOString().slice(0, 10))
    console.log('Endpoint:', GRAPHQL_ENDPOINT)

    // Get the months we need to query
    const months = getMonthsToQuery(monthsBack)
    console.log('Months to query:', months)

    // Fetch growth totals for each month
    const monthlyData = []

    for (const month of months) {
      const { from, to, startDateStr, endDateStr } = getMonthDateRange(month)

      console.log(`Querying ${month}: ${startDateStr} to ${endDateStr}`)

      try {
        const { data } = await client.query({
          query: GROWTH_TOTALS_QUERY,
          variables: {
            when: 'custom',
            from,
            to,
            sub: 'all'
          }
        })

        // Calculate territory revenue from spendingGrowth (what users paid SN for territories)
        let territoryRevenue = 0
        if (data.spendingGrowth) {
          data.spendingGrowth.forEach(entry => {
            const territorySpending = entry.data
              .filter(d => TERRITORY_REVENUE_TYPES.includes(d.name))
              .reduce((sum, d) => sum + (d.value || 0), 0)
            territoryRevenue += territorySpending
          })
        }

        // Get unique spenders from spenderGrowth (the 'total' entry has unique count)
        let uniqueSpenders = 0
        if (data.spenderGrowth) {
          data.spenderGrowth.forEach(entry => {
            const total = entry.data.find(d => d.name === 'total')
            if (total) {
              uniqueSpenders += total.value || 0
            }
          })
        }

        monthlyData.push({
          month,
          spending: data.growthTotals?.spending || 0,
          stacking: data.growthTotals?.stacking || 0,
          items: data.growthTotals?.items || 0,
          registrations: data.growthTotals?.registrations || 0,
          territoryRevenue,
          uniqueSpenders
        })
      } catch (error) {
        console.warn(`Failed to fetch growth totals for ${month}:`, error.message)
        monthlyData.push({
          month,
          spending: 'N/A',
          stacking: 'N/A',
          items: 'N/A',
          registrations: 'N/A',
          territoryRevenue: 'N/A',
          uniqueSpenders: 'N/A'
        })
      }
    }

    // Get territory profits data for each month
    const territoryProfits = []

    for (const month of months) {
      const { from, to, startDateStr, endDateStr } = getMonthDateRange(month)

      console.log(`Querying territory profits for ${month}: ${startDateStr} to ${endDateStr}`)

      try {
        const { data } = await client.query({
          query: TOP_SUBS_QUERY,
          variables: {
            when: 'custom',
            from,
            to,
            by: 'revenue'
          }
        })

        const profitableTerritories = data.topSubs.subs.filter(sub => {
          if (sub.status === 'STOPPED') return false
          const revenue = sub.optional?.revenue || 0
          return revenue > TERRITORY_PROFIT_THRESHOLD
        })

        territoryProfits.push({
          month,
          profitable: profitableTerritories.length
        })
      } catch (error) {
        console.warn(`Failed to fetch territory profits for ${month}:`, error.message)
        territoryProfits.push({ month, profitable: 'N/A' })
      }
    }

    // Get Plausible data for each month
    const plausibleData = []

    for (const month of months) {
      const { startDateStr, endDateStr } = getMonthDateRange(month)
      const dateRange = `${startDateStr},${endDateStr}`

      console.log(`Querying Plausible for ${month}: ${dateRange}`)

      try {
        // Get pageviews
        const pvResponse = await fetch(
          `https://plausible.io/api/v1/stats/timeseries?site_id=stacker.news&period=custom&date=${dateRange}&interval=month&metrics=pageviews`,
          {
            headers: { Authorization: `Bearer ${PLAUSIBLE_API_KEY}` }
          }
        )
        const pvData = await pvResponse.json()
        const pageviews = pvData.results?.[0]?.pageviews || 'N/A'

        // Get visitors
        const vResponse = await fetch(
          `https://plausible.io/api/v1/stats/timeseries?site_id=stacker.news&period=custom&date=${dateRange}&interval=month&metrics=visitors`,
          {
            headers: { Authorization: `Bearer ${PLAUSIBLE_API_KEY}` }
          }
        )
        const vData = await vResponse.json()
        const visitors = vData.results?.[0]?.visitors || 'N/A'

        plausibleData.push({ month, pageviews, visitors })
      } catch (error) {
        console.warn(`Failed to fetch Plausible data for ${month}:`, error.message)
        plausibleData.push({ month, pageviews: 'N/A', visitors: 'N/A' })
      }
    }

    // Display results (skip first month, it's just for comparison)
    console.log('\n## Registrations:')
    for (let i = 1; i < monthlyData.length; i++) {
      const current = monthlyData[i]
      const previous = monthlyData[i - 1]
      const change = current.registrations !== 'N/A' && previous.registrations !== 'N/A'
        ? ` (${calculatePercentChange(current.registrations, previous.registrations)})`
        : ''
      const value = current.registrations === 'N/A' ? 'N/A' : current.registrations
      console.log(`${formatMonth(current.month)}: ${value}${change}`)
    }

    console.log('\n## Unique Visitors:')
    for (let i = 1; i < plausibleData.length; i++) {
      const current = plausibleData[i]
      const previous = plausibleData[i - 1]
      const change = current.visitors !== 'N/A' && previous.visitors !== 'N/A'
        ? ` (${calculatePercentChange(current.visitors, previous.visitors)})`
        : ''
      const value = current.visitors === 'N/A' ? 'N/A' : formatNumber(current.visitors)
      console.log(`${formatMonth(current.month)}: ${value}${change}`)
    }

    console.log('\n## Page Views:')
    for (let i = 1; i < plausibleData.length; i++) {
      const current = plausibleData[i]
      const previous = plausibleData[i - 1]
      const change = current.pageviews !== 'N/A' && previous.pageviews !== 'N/A'
        ? ` (${calculatePercentChange(current.pageviews, previous.pageviews)})`
        : ''
      const value = current.pageviews === 'N/A' ? 'N/A' : formatNumber(current.pageviews)
      console.log(`${formatMonth(current.month)}: ${value}${change}`)
    }

    console.log('\n## Unique Spenders:')
    for (let i = 1; i < monthlyData.length; i++) {
      const current = monthlyData[i]
      const previous = monthlyData[i - 1]
      const change = current.uniqueSpenders !== 'N/A' && previous.uniqueSpenders !== 'N/A'
        ? ` (${calculatePercentChange(current.uniqueSpenders, previous.uniqueSpenders)})`
        : ''
      const value = current.uniqueSpenders === 'N/A' ? 'N/A' : formatNumber(current.uniqueSpenders)
      console.log(`${formatMonth(current.month)}: ${value}${change}`)
    }

    console.log('\n## Total Spending:')
    for (let i = 1; i < monthlyData.length; i++) {
      const current = monthlyData[i]
      const previous = monthlyData[i - 1]
      const change = current.spending !== 'N/A' && previous.spending !== 'N/A'
        ? ` (${calculatePercentChange(current.spending, previous.spending)})`
        : ''
      const value = current.spending === 'N/A' ? 'N/A' : formatSats(current.spending)
      console.log(`${formatMonth(current.month)}: ${value}${change}`)
    }

    console.log('\n## Total Stacking:')
    for (let i = 1; i < monthlyData.length; i++) {
      const current = monthlyData[i]
      const previous = monthlyData[i - 1]
      const change = current.stacking !== 'N/A' && previous.stacking !== 'N/A'
        ? ` (${calculatePercentChange(current.stacking, previous.stacking)})`
        : ''
      const value = current.stacking === 'N/A' ? 'N/A' : formatSats(current.stacking)
      console.log(`${formatMonth(current.month)}: ${value}${change}`)
    }

    console.log('\n## Territory Revenue (SN earnings):')
    for (let i = 1; i < monthlyData.length; i++) {
      const current = monthlyData[i]
      const previous = monthlyData[i - 1]
      const change = current.territoryRevenue !== 'N/A' && previous.territoryRevenue !== 'N/A'
        ? ` (${calculatePercentChange(current.territoryRevenue, previous.territoryRevenue)})`
        : ''
      const value = current.territoryRevenue === 'N/A' ? 'N/A' : formatSats(current.territoryRevenue)
      console.log(`${formatMonth(current.month)}: ${value}${change}`)
    }

    console.log('\n## Territories in Profit:')
    for (let i = 1; i < territoryProfits.length; i++) {
      const current = territoryProfits[i]
      const previous = territoryProfits[i - 1]
      const change = current.profitable !== 'N/A' && previous.profitable !== 'N/A'
        ? ` (${calculatePercentChange(current.profitable, previous.profitable)})`
        : ''
      console.log(`${formatMonth(current.month)}: ${current.profitable}${change}`)
    }

    console.log('\n---')
    if (!PLAUSIBLE_API_KEY) {
      console.log('Note: Set PLAUSIBLE_API_KEY environment variable to fetch page views and visitor data.')
    }
    console.log('Usage: GRAPHQL_ENDPOINT=url PLAUSIBLE_API_KEY=key node scripts/kpi.js [months]\n')
  } catch (error) {
    console.error('Error generating KPI summary:', error)
    process.exit(1)
  }
}

// CLI interface
const args = process.argv.slice(2)
const monthsBack = args[0] ? parseInt(args[0]) : 6

if (isNaN(monthsBack) || monthsBack < 1) {
  console.error('Usage: node scripts/kpi.js [months_back]')
  console.error('Example: node scripts/kpi.js 12  # for last 12 months')
  console.error('Example: GRAPHQL_ENDPOINT=https://stacker.news/api/graphql PLAUSIBLE_API_KEY=key node scripts/kpi.js 6')
  process.exit(1)
}

generateKPISummary(monthsBack).catch(console.error)
