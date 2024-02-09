// Date rule for use with page-metadata-parser.
// Based on https://github.com/Webhose/article-date-extractor/blob/master/articleDateExtractor/__init__.py
// Usage: import ruleSet and use in a call similar to: getMetadata(doc, url, { publicationDate: ruleSet.publicationDate })
// Some example URLs for testing purposes:

// ld+json example from 2018:
// https://mhagemann.medium.com/how-to-add-structured-json-ld-data-to-nuxt-js-8bb5f7c8a2d

// meta tag example from 2011:
// https://www.newyorker.com/magazine/2011/10/10/the-crypto-currency

// YouTube example from 2018:
// https://www.youtube.com/watch?v=YSUVRj8iznU

// A news article from 2023 (< 1 year, should not display a date):
// https://edition.cnn.com/politics/live-news/matt-gaetz-kevin-mccarthy-house-speakership-10-03-23/index.html

function cleanDateStr (dateString) {
  try {
    return new Date(dateString.match(String.raw`[0-9].*[0-9]`)[0])
  } catch {}
}

export function extractFromURL (url) {
  // Regex by Newspaper3k  - https://github.com/codelucas/newspaper/blob/master/newspaper/urls.py
  const m = url.match(String.raw`([\./\-_]{0,1}(19|20)\d{2})[\./\-_]{0,1}(([0-3]{0,1}[0-9][\./\-_])|(\w{3,5}[\./\-_]))([0-3]{0,1}[0-9][\./\-]{0,1})?`)
  if (m) {
    return cleanDateStr(m[0])
  }
}

function asDate (str) {
  if (str) {
    try {
      const d = new Date(str)
      if (!isNaN(d)) return d
    } catch { }
  }
}

export const ruleSet = {
  // note meta names are case sensitive, and scorers must not favor rules when they will not return good results.
  rules: [
    ['script[type="application/ld+json"]', node => asDate(JSON.parse(node.innerHTML)?.datePublished)],
    ['script[type="application/ld+json"]', node => asDate(JSON.parse(node.innerHTML)?.dateCreated)],
    ['script[type="application/ld+json"]', node => asDate(JSON.parse(node.innerHTML)?.dateModified)],

    ['meta[property="article:published_time"]', node => asDate(node.getAttribute('content'))],
    ['meta[name="pubdate"]', node => asDate(node.getAttribute('content'))],
    ['meta[name="publishdate"]', node => asDate(node.getAttribute('content'))],
    ['meta[name="timestamp"]', node => asDate(node.getAttribute('content'))],
    ['meta[name="dc.date.issued"]', node => asDate(node.getAttribute('content'))],
    ['meta[name="date"]', node => asDate(node.getAttribute('content'))],
    ['meta[property="bt:pubdate"]', node => asDate(node.getAttribute('content'))],
    ['meta[name="parsely-pub-date"]', node => asDate(node.getAttribute('content'))],
    ['meta[name="sailthru.date"]', node => asDate(node.getAttribute('content'))],
    ['meta[name="article.published"]', node => asDate(node.getAttribute('content'))],
    ['meta[name="published-date"]', node => asDate(node.getAttribute('content'))],
    ['meta[name="article.created"]', node => asDate(node.getAttribute('content'))],
    ['meta[name="article_date_original"]', node => asDate(node.getAttribute('content'))],
    ['meta[name="cxenseparse:recs:publishtime"]', node => asDate(node.getAttribute('content'))],
    ['meta[name="date_published"]', node => asDate(node.getAttribute('content'))],
    ['meta[itemprop="datePublished"]', node => asDate(node.getAttribute('content'))],
    ['meta[itemprop="datepublished"]', node => asDate(node.getAttribute('content'))],
    ['meta[itemprop="datecreated"]', node => asDate(node.getAttribute('content'))],
    ['meta[http-equiv="date"]', node => asDate(node.getAttribute('content'))],
    ['meta[property="og:image"]', node => asDate(extractFromURL(node.getAttribute('content')))],
    ['meta[itemprop="image"]', node => asDate(extractFromURL(node.getAttribute('content')))],

    ['time', node => asDate(node.getAttribute('datetime') || (node.getAttribute('class') === 'timestamp' && node.innerHTML))],
    ['span[itemprop="datePublished"]', node => asDate(node.getAttribute('content') || cleanDateStr(node.innerHTML))],
    ...['span', 'p', 'div'].map(tag => {
      return ['pubdate', 'timestamp', 'article_date', 'articledate', 'date'].map(className => {
        return [`${tag}[class="${className}"]`, node => asDate(cleanDateStr(node.innerHTML))]
      })
    }).flat()
  ],
  scorers: [
    (el, score) => {
      if (el.localName === 'script' && el.getAttribute('type') === 'application/ld+json' && el.innerHTML) {
        const data = JSON.parse(el.innerHTML)
        return data?.datePublished || data?.dateCreated || data?.dateModified ? 1000000 + score : 0
      }
    },
    (el, score) => el.localName === 'meta' && el.getAttribute('content') && cleanDateStr(el.getAttribute('content')) ? 1000 + score : 0,
    (el, score) => !['script', 'meta'].includes(el.localName) ? score : 0
  ]
}
