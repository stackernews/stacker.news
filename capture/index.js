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
  browser ||= await puppeteer.launch({
    headless: 'new',
    executablePath: 'google-chrome-stable',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  const url = new URL(req.originalUrl, captureUrl)
  console.time(url.href)
  console.timeLog(url.href, 'capturing', 'current pages', (await browser.pages()).length)

  // limit number of active pages
  if ((await browser.pages()).length > maxPages + 1) {
    console.timeLog(url.href, 'too many pages')
    console.timeEnd(url.href)
    return res.writeHead(503, {
      'Retry-After': 1
    }).end()
  }

  let page
  try {
    page = await browser.newPage()
    await page.setViewport({ width, height, deviceScaleFactor })
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
    await page.goto(url.href, { waitUntil: 'load', timeout })
    const file = await page.screenshot({ type: 'png', captureBeyondViewport: false })
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', `public, max-age=${cache}, immutable`)
    res.status(200).end(file)
  } catch (err) {
    console.log(err)
    return res.status(500).end()
  } finally {
    console.timeEnd(url.href)
    page?.close()
  }
})

app.listen(port, () =>
  console.log(`Screenshot listen on http://:${port}`)
)
