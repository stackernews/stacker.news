import express from 'express'
import puppeteer from 'puppeteer'
import mediaCheck from './media-check.js'
import cors from 'cors'

const captureUrl = process.env.CAPTURE_URL || 'http://host.docker.internal:3000/'
const port = process.env.PORT || 5678
const maxPages = Number(process.env.MAX_PAGES) || 5
const timeout = Number(process.env.TIMEOUT) || 10000
const cache = process.env.CACHE || 60000
const width = process.env.WIDTH || 600
const height = process.env.HEIGHT || 315
const deviceScaleFactor = process.env.SCALE_FACTOR || 2
const imageLoadTimeout = Number(process.env.IMAGE_LOAD_TIMEOUT) || 2000
// from https://www.bannerbear.com/blog/ways-to-speed-up-puppeteer-screenshots/
const args = [
  '--autoplay-policy=user-gesture-required',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-client-side-phishing-detection',
  '--disable-component-update',
  '--disable-default-apps',
  '--disable-dev-shm-usage',
  '--disable-domain-reliability',
  '--disable-extensions',
  '--disable-features=AudioServiceOutOfProcess',
  '--disable-hang-monitor',
  '--disable-ipc-flooding-protection',
  '--disable-notifications',
  '--disable-offer-store-unmasked-wallet-cards',
  '--disable-popup-blocking',
  '--disable-print-preview',
  '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding',
  '--disable-setuid-sandbox',
  '--disable-speech-api',
  '--disable-sync',
  '--hide-scrollbars',
  '--ignore-gpu-blacklist',
  '--metrics-recording-only',
  '--mute-audio',
  '--no-default-browser-check',
  '--no-first-run',
  '--no-pings',
  '--no-sandbox',
  '--no-zygote',
  '--password-store=basic',
  '--use-gl=swiftshader',
  '--use-mock-keychain'
]

let browser
const app = express()

app.get('/health', (req, res) => {
  res.status(200).end()
})

app.get('/media/:url', cors({
  origin: process.env.NEXT_PUBLIC_URL,
  methods: ['GET', 'OPTIONS'],
  credentials: false
}), mediaCheck)

app.get('/*', async (req, res) => {
  const url = new URL(req.originalUrl, captureUrl)
  const timeLabel = `${Date.now()}-${url.href}`
  if (!url.href.startsWith(captureUrl)) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(400).end()
  }

  const urlParams = new URLSearchParams(url.search)
  const commentId = urlParams.get('commentId')

  let page, pages

  try {
    console.time(timeLabel)
    browser ||= await puppeteer.launch({
      headless: 'new',
      useDataDir: './data',
      executablePath: 'google-chrome-stable',
      args,
      protocolTimeout: timeout,
      defaultViewport: { width, height, deviceScaleFactor }
    })

    pages = (await browser.pages()).length
    console.timeLog(timeLabel, 'capturing', 'current pages', pages)

    // limit number of active pages
    if (pages > maxPages + 1) {
      console.timeLog(timeLabel, 'too many pages')
      return res.writeHead(503, {
        'Cache-Control': 'no-store',
        'Retry-After': 1
      }).end()
    }

    page = await browser.newPage()
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
    const response = await page.goto(url.href, { waitUntil: 'load', timeout })
    const status = response?.status()
    console.timeLog(timeLabel, 'page loaded', 'status', status)

    if (status === 429 || status >= 500) {
      console.timeLog(timeLabel, 'upstream error')
      const retryAfter = response.headers()['retry-after']
      if (retryAfter) res.setHeader('Retry-After', retryAfter)
      res.setHeader('Cache-Control', 'no-store')
      return res.status(status).end()
    }

    if (commentId) {
      console.timeLog(timeLabel, 'scrolling to comment')
      await page.waitForSelector('.outline-it')
      await new Promise((resolve, _reject) => setTimeout(resolve, 100))
    }

    await page.evaluate(() => {
      document.getElementById('nprogress')?.remove()

      for (const navbar of document.querySelectorAll('.navbar')) {
        const mobileNav = navbar.closest('nav.d-block.d-md-none')
        const stickyNav = navbar.closest('[class*="sticky"]')
        const responsiveNav = navbar.closest('.d-none.d-md-block, .d-block.d-md-none')
        const element = mobileNav ?? stickyNav ?? responsiveNav ?? navbar
        element.style.setProperty('display', 'none', 'important')
      }
    })

    console.timeLog(timeLabel, 'waiting for images')
    await page.waitForFunction(() => {
      const visibleLoaders = document.querySelectorAll([
        '.sn-media__loading',
        '.sn-media-autolink__loading',
        '.sn-embed-wrapper__loading'
      ].join(','))

      return Array.from(visibleLoaders).every(el => {
        const rect = el.getBoundingClientRect()
        return rect.width === 0 || rect.height === 0 ||
          rect.bottom <= 0 || rect.right <= 0 ||
          rect.top >= window.innerHeight || rect.left >= window.innerWidth
      })
    }, { timeout: imageLoadTimeout }).catch(() => {})
    await page.waitForNetworkIdle({ idleTime: 250, timeout: imageLoadTimeout }).catch(() => {})
    await page.evaluate(async (imageLoadTimeout) => {
      document.getElementById('nprogress')?.remove()

      const visibleImages = Array.from(document.images).filter(img => {
        const rect = img.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 &&
          rect.bottom > 0 && rect.right > 0 &&
          rect.top < window.innerHeight && rect.left < window.innerWidth
      })

      await Promise.race([
        Promise.all(visibleImages.map(async img => {
          if (!img.complete || img.naturalWidth === 0) {
            await new Promise(resolve => {
              img.addEventListener('load', resolve, { once: true })
              img.addEventListener('error', resolve, { once: true })
            })
          }

          try {
            await img.decode?.()
          } catch {}
        })),
        new Promise(resolve => setTimeout(resolve, imageLoadTimeout))
      ])
    }, imageLoadTimeout)
    console.timeLog(timeLabel, 'images settled')

    const file = await page.screenshot({ type: 'png', captureBeyondViewport: false })
    console.timeLog(timeLabel, 'screenshot complete')
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', `public, max-age=${cache}, immutable, stale-while-revalidate=${cache * 24}, stale-if-error=${cache * 24}`)
    return res.status(200).end(file)
  } catch (err) {
    console.timeLog(timeLabel, 'error', err)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(500).end()
  } finally {
    console.timeEnd(timeLabel, 'pages at start', pages)
    page?.close().catch(console.error)
  }
})

app.listen(port, () =>
  console.log(`Screenshot listen on http://:${port}`)
)
