
import getSSRApolloClient from '../api/ssrApollo'
import generateRssFeed from '../lib/rss'
import { ITEMS } from '../fragments/items'

export default function RssFeed () {
  return null
}

export async function getServerSideProps ({ req, res }) {
  const emptyProps = { props: {} } // to avoid server side warnings
  const client = await getSSRApolloClient(req)
  const { error, data: { items: { items } } } = await client.query({
    query: ITEMS
  })

  if (!items || error) return emptyProps

  res.setHeader('Content-Type', 'text/xml; charset=utf-8')
  res.write(generateRssFeed(items))
  res.end()

  return emptyProps
}
