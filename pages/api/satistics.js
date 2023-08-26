import getSSRApolloClient from '../../api/ssrApollo'
import { WALLET_HISTORY } from '../../fragments/wallet'

export default async function handler (req, res) {
  const apollo = await getSSRApolloClient({ req, res })
  let facts = []; let cursor = null
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=satistics.csv')
  console.log(req.query.inc)
  res.write('time,type,sats\n')
  do {
    // query for items
    ({ data: { walletHistory: { facts, cursor } } } = await apollo.query({
      query: WALLET_HISTORY,
      variables: { cursor, limit: 1000, inc: req.query.inc }
    }))

    // for all items, index them
    try {
      for (const fact of facts) {
        if (!fact.status || fact.status === 'CONFIRMED') {
          res.write(`${fact.createdAt},${fact.type},${fact.sats}\n`)
        }
      }
    } catch (e) {
      // ignore errors
      console.log(e)
      res.status(500).end()
    }
  } while (cursor)

  res.status(200).end()
}
