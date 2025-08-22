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
const GROWTH_QUERY = gql`
  query Growth($when: String!, $from: String, $to: String) {
    registrationGrowth(when: $when, from: $from, to: $to) {
      time
      data {
        name
        value
      }
    }
    spendingGrowth(when: $when, from: $from, to: $to) {
      time
      data {
        name
        value
      }
    }
    spenderGrowth(when: $when, from: $from, to: $to) {
      time
      data {
        name
        value
      }
    }
    stackingGrowth(when: $when, from: $from, to: $to) {
      time
      data {
        name
        value
      }
    }
  }
`

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
  if (previous === 0) return '+100%'
  const change = ((current - previous) / previous) * 100
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(1)}%`
}

function formatMonth (monthStr) {
  // monthStr format: "2025-07" or "2025-07-01"
  const yearMonth = monthStr.slice(0, 7) // Get "2025-07" part
  const [year, month] = yearMonth.split('-')
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ]
  return `${monthNames[parseInt(month) - 1]} ${year}`
}

// Data processing functions

function processRegistrationData (registrationData) {
  const monthlyData = {}

  registrationData.forEach(entry => {
    const month = new Date(entry.time).toISOString().slice(0, 7) // YYYY-MM

    // Find referrals and organic data points
    const referrals = entry.data.find(d => d.name === 'referrals')?.value || 0
    const organic = entry.data.find(d => d.name === 'organic')?.value || 0
    const total = referrals + organic

    if (!monthlyData[month]) {
      monthlyData[month] = 0
    }
    monthlyData[month] += total
  })

  return Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({
      month,
      value
    }))
}

function processSpenderData (spenderData) {
  const monthlyData = {}

  spenderData.forEach(entry => {
    const month = new Date(entry.time).toISOString().slice(0, 7) // YYYY-MM
    const anySpenders = entry.data.find(d => d.name === 'any')

    if (anySpenders) {
      // With year aggregation, each entry should be monthly aggregated data
      monthlyData[month] = anySpenders.value
    }
  })

  return Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({
      month,
      value
    }))
}

function processAllSpending (spendingData) {
  const monthlyData = {}

  spendingData.forEach(entry => {
    const month = new Date(entry.time).toISOString().slice(0, 7) // YYYY-MM

    // Sum all spending categories: jobs, boost, fees, zaps, donations, territories
    const total = entry.data.reduce((sum, item) => {
      return sum + (item.value || 0)
    }, 0)

    if (!monthlyData[month]) {
      monthlyData[month] = 0
    }
    monthlyData[month] += total
  })

  return Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({
      month,
      value
    }))
}

// Temporarily commented out - not currently used
// function processAllStacking (stackingData) { ... }

function processTerritoryRevenue (stackingData) {
  const monthlyData = {}

  stackingData.forEach(entry => {
    const month = new Date(entry.time).toISOString().slice(0, 7) // YYYY-MM

    // Only include territories revenue
    const territoriesRevenue = entry.data.find(d => d.name === 'territories')?.value || 0

    if (!monthlyData[month]) {
      monthlyData[month] = 0
    }
    monthlyData[month] += territoriesRevenue
  })

  return Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({
      month,
      value
    }))
}

// Removed - using inline date calculations for exact month alignment

// Removed - using inline territory queries for exact month alignment

// Removed - using inline Plausible queries for exact month alignment

async function generateKPISummary (monthsBack = 6) {
  try {
    console.log(`\n# Stacker News KPI Summary (Last ${monthsBack} months)\n`)

    const now = new Date()
    console.log('Current date:', now.toISOString().slice(0, 10))
    console.log('Current month:', now.toISOString().slice(0, 7))

    // Fetch growth data using year aggregation to get monthly values
    const { data: growthData } = await client.query({
      query: GROWTH_QUERY,
      variables: {
        when: 'year'
      }
    })

    // Process registrations using corrected function
    const allRegistrations = processRegistrationData(growthData.registrationGrowth)
    // Take complete months (exclude current incomplete month) + 1 extra for comparison
    const registrations = allRegistrations.slice(-(monthsBack + 2), -1)

    // Process other metrics
    const allSpenders = processSpenderData(growthData.spenderGrowth)
    const spenders = allSpenders.slice(-(monthsBack + 2), -1)

    console.log('All available months:', allRegistrations.map(r => r.month))
    console.log('Selected months for display:', registrations.map(r => r.month))

    // Sum all spending categories for total bitcoin volume
    const allSpending = processAllSpending(growthData.spendingGrowth)
    const spending = allSpending.slice(-(monthsBack + 2), -1)

    // Get territory revenue from spending data (what users paid for territories)
    const allRevenue = processTerritoryRevenue(growthData.spendingGrowth)
    const revenue = allRevenue.slice(-(monthsBack + 2), -1)

    // Get territory profits data for the exact same months as registrations
    const territoryProfits = []

    for (const regData of registrations) {
      // For each month in registrations, get the corresponding territory profits
      const month = regData.month
      const [year, monthNum] = month.split('-').map(Number)

      try {
        // Query this specific month
        const startDate = new Date(year, monthNum - 1, 1)
        const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999)
        const from = startDate.getTime().toString()
        const to = endDate.getTime().toString()

        console.log(`Querying territory profits for ${month}: ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`)

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
          value: profitableTerritories.length
        })
      } catch (error) {
        console.warn(`Failed to fetch territory profits for ${month}:`, error.message)
        territoryProfits.push({ month, value: 'N/A' })
      }
    }

    // Get Plausible data for the exact same months as registrations
    const pageViews = []
    const visitors = []

    for (const regData of registrations) {
      // For each month in registrations, get the corresponding Plausible data
      const month = regData.month
      const [year, monthNum] = month.split('-').map(Number)

      try {
        // Query this specific month
        const startDate = new Date(year, monthNum - 1, 1)
        const endDate = new Date(year, monthNum, 0)
        const dateRange = `${startDate.toISOString().slice(0, 10)},${endDate.toISOString().slice(0, 10)}`

        console.log(`Querying Plausible for ${month}: ${dateRange}`)

        // Get pageviews
        const pvResponse = await fetch(
          `https://plausible.io/api/v1/stats/timeseries?site_id=stacker.news&period=custom&date=${dateRange}&interval=month&metrics=pageviews`,
          {
            headers: { Authorization: `Bearer ${PLAUSIBLE_API_KEY}` }
          }
        )
        const pvData = await pvResponse.json()
        const pageviewValue = pvData.results?.[0]?.pageviews || 'N/A'
        pageViews.push({ month, value: pageviewValue })

        // Get visitors
        const vResponse = await fetch(
          `https://plausible.io/api/v1/stats/timeseries?site_id=stacker.news&period=custom&date=${dateRange}&interval=month&metrics=visitors`,
          {
            headers: { Authorization: `Bearer ${PLAUSIBLE_API_KEY}` }
          }
        )
        const vData = await vResponse.json()
        const visitorValue = vData.results?.[0]?.visitors || 'N/A'
        visitors.push({ month, value: visitorValue })
      } catch (error) {
        console.warn(`Failed to fetch Plausible data for ${month}:`, error.message)
        pageViews.push({ month, value: 'N/A' })
        visitors.push({ month, value: 'N/A' })
      }
    }

    console.log('Registration months:', registrations.map(r => r.month))
    console.log('PageViews months:', pageViews.map(p => p.month))
    console.log('Visitors months:', visitors.map(v => v.month))
    console.log('Territory Profits months:', territoryProfits.map(t => t.month))

    // Display results
    console.log('## Registrations:')
    // Start from index 1 if we have extra data for comparison, otherwise start from 0
    const startIndex = registrations.length > monthsBack ? 1 : 0
    for (let i = startIndex; i < registrations.length; i++) {
      const current = registrations[i]
      const previous = registrations[i - 1]
      const change = previous ? ` (${calculatePercentChange(current.value, previous.value)})` : ''
      console.log(`${formatMonth(current.month + '-01')}: ${current.value}${change}`)
    }

    console.log('\n## Unique Visitors:')
    for (let i = startIndex; i < visitors.length; i++) {
      const current = visitors[i]
      const previous = visitors[i - 1]
      const change = previous && current.value !== 'N/A' && previous.value !== 'N/A'
        ? ` (${calculatePercentChange(current.value, previous.value)})`
        : ''
      const formattedValue = current.value === 'N/A' ? 'N/A' : formatNumber(current.value)
      console.log(`${formatMonth(current.month + '-01')}: ${formattedValue}${change}`)
    }

    console.log('\n## Monthly Spenders:')
    for (let i = startIndex; i < spenders.length; i++) {
      const current = spenders[i]
      const previous = spenders[i - 1]
      const change = previous ? ` (${calculatePercentChange(current.value, previous.value)})` : ''
      console.log(`${formatMonth(current.month + '-01')}: ${current.value}${change}`)
    }

    console.log('\n## Page Views:')
    for (let i = startIndex; i < pageViews.length; i++) {
      const current = pageViews[i]
      const previous = pageViews[i - 1]
      const change = previous && current.value !== 'N/A' && previous.value !== 'N/A'
        ? ` (${calculatePercentChange(current.value, previous.value)})`
        : ''
      const formattedValue = current.value === 'N/A' ? 'N/A' : formatNumber(current.value)
      console.log(`${formatMonth(current.month + '-01')}: ${formattedValue}${change}`)
    }

    console.log('\n## Total Bitcoin Volume (Spending):')
    for (let i = startIndex; i < spending.length; i++) {
      const current = spending[i]
      const previous = spending[i - 1]
      const change = previous ? ` (${calculatePercentChange(current.value, previous.value)})` : ''
      console.log(`${formatMonth(current.month + '-01')}: ${formatSats(current.value)}${change}`)
    }

    console.log('\n## Total Bitcoin Revenue (Territory Billing):')
    for (let i = startIndex; i < revenue.length; i++) {
      const current = revenue[i]
      const previous = revenue[i - 1]
      const change = previous ? ` (${calculatePercentChange(current.value, previous.value)})` : ''
      console.log(`${formatMonth(current.month + '-01')}: ${formatSats(current.value)}${change}`)
    }

    console.log('\n## Territories in Profit:')
    for (let i = startIndex; i < territoryProfits.length; i++) {
      const current = territoryProfits[i]
      const previous = territoryProfits[i - 1]
      const change = previous && current.value !== 'N/A' && previous.value !== 'N/A'
        ? ` (${calculatePercentChange(current.value, previous.value)})`
        : ''
      console.log(`${formatMonth(current.month + '-01')}: ${current.value}${change}`)
    }

    console.log('\n---')
    if (!PLAUSIBLE_API_KEY) {
      console.log('Note: Set PLAUSIBLE_API_KEY environment variable to fetch page views and visitor data.')
    }
    console.log('Usage: PLAUSIBLE_API_KEY=your_key node scripts/kpi.js [months]\n')
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
  console.error('Example: PLAUSIBLE_API_KEY=key node scripts/kpi.js 6')
  process.exit(1)
}

generateKPISummary(monthsBack).catch(console.error)
