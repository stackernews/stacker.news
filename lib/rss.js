import getSSRApolloClient from '@/api/ssrApollo'

const DEFAULT_SITE_URL = 'https://stacker.news'
const SITE_TITLE = 'stacker news'
const SITE_SUBTITLE = 'moderating forums with money'

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

const generateRssItem = (item, siteUrl) => {
  const guid = `${siteUrl}/items/${item.id}`
  const link = item.url || guid
  let title = item.title
  if (item.isJob) {
    title = item.title + ' \\ ' + item.company + ' \\ ' + `${item.location || ''}${item.location && item.remote ? ' or ' : ''}${item.remote ? 'Remote' : ''}`
  }
  const category = item.subNames?.map(subName => `<category domain="${siteUrl}/~${subName}">${subName}</category>`).join('') ?? ''
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

function generateRssFeed (items, sub = null, siteUrl = DEFAULT_SITE_URL) {
  const itemsList = items.map(item => generateRssItem(item, siteUrl))
  const subPath = sub ? `/~${sub}` : ''
  return `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
      <channel>
        <title>${SITE_TITLE}${sub ? ` ~${sub}` : ''}</title>
        <link>${siteUrl}${subPath}</link>
        <description>${SITE_SUBTITLE}</description>
        <language>en</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        <atom:link href="${siteUrl}${subPath}/rss" rel="self" type="application/rss+xml" />
        ${itemsList.join('')}
      </channel>
    </rss>
  `
}

function getSiteUrl (req) {
  if (req.headers['x-stacker-news-subname']) {
    const proto = req.headers['x-forwarded-proto'] || 'https'
    return `${proto}://${req.headers.host}`
  }
  return DEFAULT_SITE_URL
}

export default function getGetRssServerSideProps (query, variables = null) {
  return async function ({ req, res, query: params }) {
    const emptyProps = { props: {} } // to avoid server side warnings
    const client = await getSSRApolloClient({ req, res })
    const { error, data: { items: { items } } } = await client.query({
      query, variables: { ...params, ...variables }
    })

    if (!items || error) return emptyProps

    const siteUrl = getSiteUrl(req)
    res.setHeader('Content-Type', 'text/xml; charset=utf-8')
    res.write(generateRssFeed(items, params?.sub, siteUrl))
    res.end()

    return emptyProps
  }
}
