import getSSRApolloClient from '../api/ssrApollo'

const SITE_URL = 'https://stacker.news'
const SITE_TITLE = 'Stacker News'
const SITE_SUBTITLE = 'Like Hacker News, but we pay you Bitcoin.'

function escapeXml (unsafe) {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '\'': return '&apos;'
      case '"': return '&quot;'
    }
  })
}

const generateRssItem = (item) => {
  const guid = `${SITE_URL}/items/${item.id}`
  const link = item.url || guid
  return `
    <item>
      <guid>${SITE_URL}/items/${item.id}</guid>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(link)}</link>
      <comments>${guid}</comments>
      <description><![CDATA[<a href="${guid}">Comments</a>]]></description>
      <pubDate>${new Date(item.createdAt).toUTCString()}</pubDate>
    </item>
  `
}

function generateRssFeed (items) {
  const itemsList = items.map(generateRssItem)
  return `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
      <channel>
        <title>${SITE_TITLE}</title>
        <link>${SITE_URL}</link>
        <description>${SITE_SUBTITLE}</description>
        <language>en</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        <atom:link href="${SITE_URL}/rss" rel="self" type="application/rss+xml" />
        ${itemsList.join('')}
      </channel>
    </rss>
  `
}

export default function getGetRssServerSideProps(query, variables = null) {
  return async function ({ req, res }) {
    const emptyProps = { props: {} } // to avoid server side warnings
    const client = await getSSRApolloClient(req)
    const { error, data: { items: { items } } } = await client.query({
      query, variables
    })

    if (!items || error) return emptyProps

    res.setHeader('Content-Type', 'text/xml; charset=utf-8')
    res.write(generateRssFeed(items))
    res.end()

    return emptyProps
  }
}
