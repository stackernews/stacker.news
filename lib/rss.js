import getSSRApolloClient from '@/api/ssrApollo'
import { getDomainMapping } from '@/lib/domains'
import { getSeoWithFallback } from '@/lib/domains/seo'
import { getRequestOrigin } from '@/lib/safe-url'

const SITE_URL = 'https://stacker.news'
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

const generateRssItem = (item, { url, domainSubName }) => {
  const guid = `${url}/items/${item.id}`
  const link = item.url || guid
  let title = item.title
  if (item.isJob) {
    title = item.title + ' \\ ' + item.company + ' \\ ' + `${item.location || ''}${item.location && item.remote ? ' or ' : ''}${item.remote ? 'Remote' : ''}`
  }

  // a custom domain only hosts its bound sub. cross-posted subs live on the main site,
  // so their <category> links must point back there to stay valid.
  const category = item.subNames?.map(subName => {
    if (subName === domainSubName) {
      return `<category domain="${url}">${subName}</category>`
    }
    return `<category domain="${SITE_URL}/~${subName}">${subName}</category>`
  }).join('') ?? ''

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

function generateRssFeed (items, { sub = null, site }) {
  const itemsList = items.map(item => generateRssItem(item, { url: site.url, domainSubName: site.domainSubName }))
  return `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
      <channel>
        <title>${escapeXml(site.title)}${sub ? ` ~${sub}` : ''}</title>
        <link>${escapeXml(site.url)}${sub ? `/~${sub}` : ''}</link>
        <description>${escapeXml(site.subtitle)}</description>
        <language>en</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        <atom:link href="${escapeXml(site.url)}/rss" rel="self" type="application/rss+xml" />
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

    const host = req?.headers?.host
    let domainMapping = null
    if (host) {
      try {
        domainMapping = await getDomainMapping(host)
      } catch (error) {
        console.error('[rss] error getting custom domain SEO', error)
        domainMapping = null
      }
    }

    const customSeo = domainMapping
      ? getSeoWithFallback(domainMapping)
      : null

    const site = {
      url: (customSeo && getRequestOrigin(req)) ?? SITE_URL,
      title: customSeo?.title ?? SITE_TITLE,
      subtitle: customSeo?.tagline ?? SITE_SUBTITLE,
      domainSubName: domainMapping?.subName ?? null
    }

    res.setHeader('Content-Type', 'text/xml; charset=utf-8')
    res.write(generateRssFeed(items, { sub: !customSeo ? params?.sub : null, site }))
    res.end()

    return emptyProps
  }
}
