const { getMetadata } = require('page-metadata-parser')
const domino = require('domino')
const { ensureProtocol } = require('./url')

// Get a publication date given a URL.
//
// Ported from https://github.com/Webhose/article-date-extractor/blob/master/articleDateExtractor/__init__.py
//
// Example usage:
//
// import { loadURL, extractArticlePublishedDate } from './lib/timedate-scraper.js'
// console.log(extractArticlePublishedDate(await loadURL('https://finance.yahoo.com/news/europe-spot-bitcoin-etf-means-090100353.html')))

exports.loadURL = async function (url) {
  const response = await fetch(ensureProtocol(url), { redirect: 'follow' })
  const html = await response.text()
  return { url, doc: domino.createWindow(html).document }
}

exports.parseStrDate = function (dateString) {
  try {
    return new Date(dateString.match(String.raw`[0-9].*[0-9]`)[0])
  } catch {}
}

exports.extractFromURL = function (url) {
  // Regex by Newspaper3k  - https://github.com/codelucas/newspaper/blob/master/newspaper/urls.py
  const m = url.match(String.raw`([\./\-_]{0,1}(19|20)\d{2})[\./\-_]{0,1}(([0-3]{0,1}[0-9][\./\-_])|(\w{3,5}[\./\-_]))([0-3]{0,1}[0-9][\./\-]{0,1})?`)
  if (m) {
    return exports.parseStrDate(m[0])
  }
}

// returns { date, source } or undefined
exports.extractFromLDJson = function ({ url, doc }) {
  try {
    const { date: ldjson } = getMetadata(doc, url, {
      date: {
        rules: [['script[type="application/ld+json"]', node => JSON.parse(node.innerHTML)]]
      }
    })
    const date = ldjson.datePublished || ldjson.dateCreated || ldjson.dateModified
    if (date) return { date, source: 'script[type="application/ld+json"]' }
  } catch {}
}

// returns { date, source } or undefined
exports.extractFromMeta = function ({ url, doc }) {
  const dateRules = {
    rules: [
      ['meta[property="article:published_time"]', node => node.getAttribute('content')],
      ['meta[name="pubdate"]', node => node.getAttribute('content')],
      ['meta[name="publishdate"]', node => node.getAttribute('content')],
      ['meta[name="timestamp"]', node => node.getAttribute('content')],
      ['meta[name="dc.date.issued"]', node => node.getAttribute('content')],
      ['meta[name="date"]', node => node.getAttribute('content')],
      ['meta[property="bt:pubdate"]', node => node.getAttribute('content')],
      ['meta[name="parsely-pub-date"]', node => node.getAttribute('content')],
      ['meta[name="sailthru.date"]', node => node.getAttribute('content')],
      ['meta[name="article.published"]', node => node.getAttribute('content')],
      ['meta[name="published-date"]', node => node.getAttribute('content')],
      ['meta[name="article.created"]', node => node.getAttribute('content')],
      ['meta[name="article_date_original"]', node => node.getAttribute('content')],
      ['meta[name="cxenseparse:recs:publishtime"]', node => node.getAttribute('content')],
      ['meta[name="date_published"]', node => node.getAttribute('content')],
      ['meta[itemprop="datepublished"]', node => node.getAttribute('content')],
      ['meta[itemprop="datecreated"]', node => node.getAttribute('content')],
      ['meta[http-equiv="date"]', node => node.getAttribute('content')],

      // note: rules stop if selector matches, even when callback returns false
      ['meta[property="og:image"]', node => exports.extractFromURL(node.getAttribute('content'))],
      ['meta[itemprop="image"]', node => exports.extractFromURL(node.getAttribute('content'))]
    ]
  }
  const { date } = getMetadata(doc, url, { date: dateRules })
  if (date) return { date, source: 'meta' }
}

// returns { date, source } or undefined
exports.extractFromHTMLTag = function ({ url, doc }) {
  let date
  ({ date } = getMetadata(doc, url, {
    date: {
      rules: [
        ['time', node => node.getAttribute('datetime') || (node.getAttribute('class') === 'timestamp' && node.innerHTML)]
      ]
    }
  }))
  if (date) return { date, source: 'time[datetime]' };

  ({ date } = getMetadata(doc, url, {
    date: {
      rules: [
        ['span[itemprop]="datePublished"]', node => node.getAttribute('content') || exports.parseStrDate(node.innerHTML)]
      ]
    }
  }))
  if (date) return { date, source: 'span[itemprop]="datePublished"]' }

  for (const tag of ['span', 'p', 'div']) {
    for (const className of ['pubdate', 'timestamp', 'article_date', 'articledate', 'date']) {
      ({ date } = getMetadata(doc, url, {
        date: {
          rules: [[`${tag}[class="${className}"]`, node => node.innerHTML]]
        }
      }))
      if (exports.parseStrDate(date)) return { date: exports.parseStrDate(date), source: `${tag}[class="${className}"]` }
    }
  }
}

// returns { date, source } or undefined
exports.extractArticlePublishedDate = function ({ url, doc }) {
  console.log('Extracting date from', url)
  let articleDate
  try {
    articleDate = { date: exports.extractFromURL(url), source: 'url' }
    let possibleDate = exports.extractFromLDJson({ url, doc })
    if (!possibleDate) possibleDate = exports.extractFromMeta({ url, doc })
    if (!possibleDate) possibleDate = exports.extractFromHTMLTag({ url, doc })
    if (possibleDate) articleDate = possibleDate
  } catch (e) {
    console.log('Exception in extractArticlePublishedDate for', url)
    console.log(e)
  }
  if (articleDate) {
    try {
      const d = new Date(articleDate.date)
      if (!isNaN(d)) articleDate.date = d
    } catch {}
  }
  return articleDate
}
