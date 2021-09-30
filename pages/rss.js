
import getSSRApolloClient from '../api/ssrApollo'
import generateRssFeed from '../lib/rss'
import { MORE_ITEMS } from '../fragments/items'

export default function RssFeed () {
  return null
}

export async function getServerSideProps ({ req, res }) {
  const emptyProps = { props: {} } // to avoid server side warnings
  const client = await getSSRApolloClient(req)
  const { error, data: { moreItems: { items } } } = await client.query({
    query: MORE_ITEMS,
    variables: { sort: 'hot' }
  })

  if (!items || error) return emptyProps

  res.setHeader('Content-Type', 'text/xml')
  res.write(generateRssFeed(items))
  res.end()

  return emptyProps
}
