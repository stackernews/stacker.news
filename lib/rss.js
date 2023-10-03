import getSSRApolloClient from '../api/ssrApollo'

const SITE_URL = 'https://stacker.news'
const SITE_TITLE = 'stacker news'
const SITE_SUBTITLE = 'It\'s like Hacker News, but we pay you Bitcoin.'

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
  let title = item.title
  if (item.isJob) {
    title = item.title + ' \\ ' + item.company + ' \\ ' + `${item.location || ''}${item.location && item.remote ? ' or ' : ''}${item.remote ? 'Remote' : ''}`
  }
  const category = item.subName ? `<category domain="${SITE_URL}/~${item.subName}">${item.subName}</category>` : '<category></category>'
  return `
    <item>
      <guid>${guid}</guid>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <comments>${guid}</comments>
      <description><![CDATA[<a href="${guid}">Comments</a>]]></description>
      <pubDate>${new Date(item.createdAt).toUTCString()}</pubDate>
      ${category}
      <atom:author><atom:name>${item.user.name}</atom:name></atom:author>
    </item>
  `
}

function generateRssFeed (items, sub = null) {
  const itemsList = items.map(generateRssItem)
  return `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
      <channel>
        <title>${SITE_TITLE}${sub ? ` ~${sub}` : ''}</title>
        <link>${SITE_URL}${sub ? `/~${sub}` : ''}</link>
        <description>${SITE_SUBTITLE}</description>
        <language>en</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        <atom:link href="${SITE_URL}/rss" rel="self" type="application/rss+xml" />
        ${itemsList.join('')}
      </channel>
    </rss>
  `
}

export default function getGetRssServerSideProps (query, variables = null) {
  return async function ({ req, res, query: params }) {
    const emptyProps = { props: {} } // to avoid server side warnings
    const client = await getSSRApolloClient({ req, res })
    const { error, data: { items: { items } } } = await client.query({
      query, variables: { ...params, ...variables }
    })

    if (!items || error) return emptyProps

    res.setHeader('Content-Type', 'text/xml; charset=utf-8')
    res.write(generateRssFeed(items, params?.sub))
    res.end()

    return emptyProps
  }
}
