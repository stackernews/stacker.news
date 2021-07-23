const SITE_URL = 'https://stacker.news'
const SITE_TITLE = 'Stacker News'
const SITE_SUBTITLE = 'Like Hacker News, but with sats'

const generateRssItem = (item) => {
  return `
    <item>
      <guid>${SITE_URL}/items/${item.id}</guid>
      <title>${item.title}</title>
      <link>${SITE_URL}/items/${item.id}</link>
      <pubDate>${new Date(item.createdAt).toUTCString()}</pubDate>
    </item>
  `
}

export default function generateRssFeed (items) {
  const itemsList = items.map(generateRssItem)
  return `
    <rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" version="2.0">
      <channel>
        <title>${SITE_TITLE}</title>
        <link>${SITE_URL}</link>
        <description>${SITE_SUBTITLE}</description>
        <language>en</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        <atom:link href="${SITE_URL}" rel="self" type="application/rss+xml"/>
        ${itemsList.join('')}
      </channel>
    </rss>
  `
}
