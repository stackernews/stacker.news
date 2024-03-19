import getSSRApolloClient from '@/api/ssrApollo'
import { ITEM_OTS } from '@/fragments/items'
import stringifyCanon from 'canonical-json'

export default async function handler (req, res) {
  const client = await getSSRApolloClient({ req, res })
  const { data } = await client.query({
    query: ITEM_OTS,
    variables: { id: req.query.id }
  })

  if (!data?.item) {
    res.status(404).end()
  }

  const { item } = data
  const itemString = stringifyCanon({ parentHash: item.parentOtsHash, title: item.title, text: item.text, url: item.url })

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="sn-item-${req.query.id}.json"`)
  res.write(itemString)
  res.status(200).end()
}
