import express from 'express'
import puppeteer from 'puppeteer'

const captureUrl = process.env.CAPTURE_URL || 'http://host.docker.internal:3000/'
const port = process.env.PORT || 5678
const maxPages = process.env.MAX_PAGES || 5
const timeout = process.env.TIMEOUT || 10000
const cache = process.env.CACHE || 60000
const width = process.env.WIDTH || 600
const height = process.env.HEIGHT || 315
const deviceScaleFactor = process.env.SCALE_FACTOR || 2

let browser
const app = express()

app.get('/health', (req, res) => {
  res.status(200).end()
})

app.get('/*', async (req, res) => {
  const url = new URL(req.originalUrl, captureUrl)
  const timeLabel = `${Date.now()}-${url.href}`

  let page

  try {
    console.time(timeLabel)
    browser ||= await puppeteer.launch({
      headless: 'new',
      executablePath: 'google-chrome-stable',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    console.timeLog(timeLabel, 'capturing', 'current pages', (await browser.pages()).length)

    // limit number of active pages
    if ((await browser.pages()).length > maxPages + 1) {
      console.timeLog(timeLabel, 'too many pages')
      return res.writeHead(503, {
        'Retry-After': 1
      }).end()
    }

    page = await browser.newPage()
    await page.setViewport({ width, height, deviceScaleFactor })
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
    await page.goto(url.href, { waitUntil: 'load', timeout })
    const file = await page.screenshot({ type: 'png', captureBeyondViewport: false })
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', `public, max-age=${cache}, immutable, stale-while-revalidate=${cache * 24}, stale-if-error=${cache * 24}`)
    return res.status(200).end(file)
  } catch (err) {
    console.timeLog(timeLabel, 'error', err)
    return res.status(500).end()
  } finally {
    console.timeEnd(timeLabel)
    page?.close().catch(console.error)
  }
})

app.listen(port, () =>
  console.log(`Screenshot listen on http://:${port}`)
)
