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
  return `
    <item>
      <guid>${SITE_URL}/items/${item.id}</guid>
      <title>${escapeXml(item.title)}</title>
      <link>${SITE_URL}/items/${item.id}</link>
      <pubDate>${new Date(item.createdAt).toUTCString()}</pubDate>
    </item>
  `
}

export default function generateRssFeed (items) {
  const itemsList = items.map(generateRssItem)
  return `
    <rss version="2.0">
      <channel>
        <title>${SITE_TITLE}</title>
        <link>${SITE_URL}</link>
        <description>${SITE_SUBTITLE}</description>
        <language>en</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        <link>${SITE_URL}</link>
        ${itemsList.join('')}
      </channel>
    </rss>
  `
}
