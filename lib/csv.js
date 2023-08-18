import getSSRApolloClient from '../api/ssrApollo'

function escapeCsv (unsafe) {
  // See RFC https://www.ietf.org/rfc/rfc4180.txt
  if (unsafe.match(/^[^,\r\n"]+$/g)) {
    return unsafe // this string has no unsafe characters
  } else {
    return '"' + unsafe.replace(/["]/g, '""') + '"'
  }
}

// These two functions define the CSV format and transform stacker.news internal data to it.
// The CSV format constitutes a public-facing API, so take care!
// Beware not to introduce extra whitespace in the template strings, too!
function generateCsvFile (facts, sub = null) {
  return `Date,Type,Fee,Sats In,Sats Out,Status,Description
${facts.map(generateCsvItem).join('')}`
}
const generateCsvItem = ({ createdAt, type, sats, satsFee, status, description, item }) => {
  return `${
    createdAt},${
    {
      invoice: 'DEPOSIT',
      withdrawal: 'WITHDRAWAL',
      stacked: 'STACK',
      earn: 'EARNINGS',
      referral: 'REFERRAL',
      spent: 'SPEND',
      donation: 'DONATION'
    }[type]},${
    Math.abs(satsFee).toString() !== '0' ? Math.abs(satsFee) : ''},${
    sats >= 0 ? sats : ''},${
    sats < 0 ? -sats : ''},${
    status
      ? {
          CONFIRMED: 'CONFIRMED',
          EXPIRED: 'EXPIRED',
          CANCELLED: 'CANCELLED',
          PENDING: 'PENDING',
          INSUFFICIENT_BALANCE: 'INSUFFICIENT BALANCE',
          INVALID_PAYMENT: 'PAYMENT ERROR',
          PATHFINDING_TIMEOUT: 'PAYMENT ERROR',
          ROUTE_NOT_FOUND: 'PAYMENT ERROR'
        }[status]
      : ''},${
    escapeCsv(description || (item?.title ? 'Title: ' + item?.title : undefined) || '')}
`
}

export default function getGetCsvServerSideProps (query, variables = null) {
  return async function ({ req, res, query: params }) {
    const emptyProps = { props: {} } // to avoid server side warnings
    const client = await getSSRApolloClient({ req, res })
    const { error, data: { walletHistory: { facts } } } = await client.query({
      query, variables: { ...params, ...variables }
    })

    if (!facts || error) return emptyProps

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.write(generateCsvFile(facts, params?.sub))
    res.end()

    return emptyProps
  }
}
