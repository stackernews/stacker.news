import express from 'express'
import puppeteer from 'puppeteer-core'
import mediaCheck from './media-check.js'
import cors from 'cors'

const captureUrl = process.env.CAPTURE_URL || 'http://host.docker.internal:3000/'
const captureBaseUrl = new URL(captureUrl)
const port = process.env.PORT || 5678
const maxPages = Number(process.env.MAX_PAGES) || 5
const timeout = Number(process.env.TIMEOUT) || 10000
const protocolTimeout = Number(process.env.PROTOCOL_TIMEOUT) || 30000
const browserCloseTimeout = Number(process.env.BROWSER_CLOSE_TIMEOUT) || 2000
const browserResetMaxWait = Number(process.env.BROWSER_RESET_MAX_WAIT) || protocolTimeout
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
let browserPromise
let browserResetRequestedAt = null
let browserResetPromise
let activeCaptures = 0
let captureCount = 0
const inflightCaptures = new Map()
const app = express()
const retryLaterResult = {
  status: 503,
  headers: {
    'Cache-Control': 'no-store',
    'Retry-After': '1'
  }
}

function requestBrowserReset (targetBrowser = browser) {
  if (targetBrowser && targetBrowser !== browser) return
  browserResetRequestedAt ??= Date.now()
}

async function getBrowser () {
  await resetBrowserIfIdle()
  if (browserResetPromise) await browserResetPromise
  if (browser?.connected) return browser
  if (browser) {
    console.error('browser disconnected, closing old browser')
    const oldBrowser = browser
    browser = undefined
    browserPromise = null
    await closeBrowser(oldBrowser)
  }

  browserPromise ||= puppeteer.launch({
    headless: 'new',
    executablePath: 'google-chrome-stable',
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    args,
    protocolTimeout,
    defaultViewport: { width, height, deviceScaleFactor }
  }).then(b => {
    browser = b
    return b
  }).finally(() => {
    browserPromise = null
  })

  return await browserPromise
}

async function closeBrowser (oldBrowser) {
  const browserProcess = oldBrowser.process?.()
  let closeFailed = false
  const timedOut = await withTimeout(oldBrowser.close().catch(err => {
    closeFailed = true
    console.error(err)
  }), browserCloseTimeout, 'browser close')
  if ((timedOut || closeFailed) && browserProcess && browserProcess.exitCode === null) {
    await new Promise(resolve => {
      const done = () => {
        clearTimeout(timeout)
        browserProcess.off('exit', done)
        resolve()
      }
      const timeout = setTimeout(() => {
        console.error(`browser process exit timed out after ${browserCloseTimeout}ms`)
        done()
      }, browserCloseTimeout)
      browserProcess.once('exit', done)
      browserProcess.kill('SIGKILL')
    })
  }
}

async function withTimeout (promise, ms, label) {
  let timeout
  let timedOut = false
  try {
    await Promise.race([
      promise,
      new Promise(resolve => {
        timeout = setTimeout(() => {
          timedOut = true
          console.error(`${label} timed out after ${ms}ms`)
          resolve()
        }, ms)
      })
    ])
    return timedOut
  } finally {
    clearTimeout(timeout)
  }
}

async function resetBrowser () {
  browserResetPromise ||= (async () => {
    const oldBrowser = browser
    browser = undefined
    browserPromise = null
    if (oldBrowser) {
      await closeBrowser(oldBrowser)
    }
    browserResetRequestedAt = null
  })().finally(() => {
    browserResetPromise = null
  })

  await browserResetPromise
}

async function resetBrowserIfIdle () {
  if (browserResetRequestedAt === null) return
  if (activeCaptures > 0 && Date.now() - browserResetRequestedAt < browserResetMaxWait) return
  if (activeCaptures > 0) {
    console.error(`forcing browser reset after ${Date.now() - browserResetRequestedAt}ms with ${activeCaptures} active captures`)
  }

  await resetBrowser()
}

function isProtocolError (err) {
  return err?.name === 'ProtocolError' ||
    err?.name === 'TargetCloseError' ||
    err?.message?.includes('ProtocolError') ||
    err?.message?.includes('Protocol error') ||
    err?.message?.includes('Session closed') ||
    err?.message?.includes('Target closed')
}

function isAssetPath (pathname) {
  return pathname.startsWith('/_next/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/sw.js' ||
    pathname === '/robots.txt' ||
    pathname === '/manifest.json' ||
    pathname === '/site.webmanifest' ||
    pathname === '/api/site.webmanifest' ||
    /\/(?:favicon[^/]*|apple-touch-icon[^/]*)$/.test(pathname)
}

async function addCaptureCleanupScript (page) {
  await page.evaluateOnNewDocument(() => {
    function installCaptureCss () {
      const style = document.createElement('style')
      style.textContent = `
        #nprogress,
        .navbar,
        nav.d-block.d-md-none:has(.navbar),
        [class*="sticky"]:has(.navbar),
        .d-none.d-md-block:has(.navbar),
        .d-block.d-md-none:has(.navbar) {
          display: none !important;
        }
      `
      ;(document.head ?? document.documentElement).appendChild(style)
    }

    if (document.documentElement) {
      installCaptureCss()
    } else {
      document.addEventListener('DOMContentLoaded', installCaptureCss, { once: true })
    }
  })
}

async function captureImage (url, timeLabel) {
  let page
  let captureBrowser
  let captured = false

  try {
    console.time(timeLabel)

    await resetBrowserIfIdle()
    if (browserResetRequestedAt !== null) {
      console.timeLog(timeLabel, 'browser reset pending', 'active captures', activeCaptures)
      return retryLaterResult
    }

    if (activeCaptures >= maxPages) {
      console.timeLog(timeLabel, 'too many captures')
      return retryLaterResult
    }
    activeCaptures++
    captured = true
    console.timeLog(timeLabel, 'capturing', 'active captures', activeCaptures)

    const urlParams = new URLSearchParams(url.search)
    const commentId = urlParams.get('commentId')

    console.timeLog(timeLabel, 'creating page')
    captureBrowser = await getBrowser()
    page = await captureBrowser.newPage()
    console.timeLog(timeLabel, 'page created')
    await addCaptureCleanupScript(page)
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
    console.timeLog(timeLabel, 'navigating')
    const response = await page.goto(url.href, { waitUntil: 'load', timeout })
    const status = response?.status()
    console.timeLog(timeLabel, 'page loaded', 'status', status)

    if (status === 429 || status >= 500) {
      console.timeLog(timeLabel, 'upstream error')
      const retryAfter = response.headers()['retry-after']
      const headers = { 'Cache-Control': 'no-store' }
      if (retryAfter) headers['Retry-After'] = retryAfter
      return { status, headers }
    }

    if (commentId) {
      console.timeLog(timeLabel, 'scrolling to comment')
      const comment = await page.waitForSelector('.outline-it', { timeout: imageLoadTimeout }).catch(() => null)
      if (comment) await new Promise((resolve, _reject) => setTimeout(resolve, 100))
    }

    console.timeLog(timeLabel, 'waiting for media placeholders')
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
    console.timeLog(timeLabel, 'media placeholders settled')
    console.timeLog(timeLabel, 'waiting for network idle')
    await page.waitForNetworkIdle({ idleTime: 250, timeout: imageLoadTimeout }).catch(() => {})
    console.timeLog(timeLabel, 'network idle settled')

    console.timeLog(timeLabel, 'taking screenshot')
    const body = await page.screenshot({ type: 'png', captureBeyondViewport: false })
    console.timeLog(timeLabel, 'screenshot complete')
    return {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': `public, max-age=${cache}, immutable, stale-while-revalidate=${cache * 24}, stale-if-error=${cache * 24}`
      },
      body
    }
  } catch (err) {
    console.timeLog(timeLabel, 'error', err)
    if (isProtocolError(err)) {
      requestBrowserReset(captureBrowser)
    }
    return {
      status: 500,
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  } finally {
    if (captured) activeCaptures = Math.max(0, activeCaptures - 1)
    console.timeEnd(timeLabel, 'active captures', activeCaptures)
    if (browserResetRequestedAt === null && page) {
      let closeFailed = false
      const timedOut = await withTimeout(page.close().catch(err => {
        closeFailed = true
        console.error(err)
      }), browserCloseTimeout, 'page close')
      if (timedOut || closeFailed) requestBrowserReset(captureBrowser)
    }
    await resetBrowserIfIdle()
  }
}

app.get('/health', async (req, res) => {
  await resetBrowserIfIdle()
  if (browserResetRequestedAt !== null || browserResetPromise) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(503).end()
  }

  res.status(200).end()
})

app.get('/media/:url', cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  credentials: false
}), mediaCheck)

app.get('/*', async (req, res) => {
  const url = new URL(req.originalUrl, captureBaseUrl)
  const timeLabel = `${Date.now()}-${++captureCount}-${url.href}`
  if (url.origin !== captureBaseUrl.origin) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(400).end()
  }
  if (isAssetPath(url.pathname)) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(404).end()
  }

  const cacheKey = url.href
  let joined = false
  let capturePromise = inflightCaptures.get(cacheKey)
  if (capturePromise) {
    joined = true
    console.time(timeLabel)
    console.timeLog(timeLabel, 'joining inflight capture')
  } else {
    capturePromise = captureImage(url, timeLabel).finally(() => {
      inflightCaptures.delete(cacheKey)
    })
    inflightCaptures.set(cacheKey, capturePromise)
  }

  const result = await capturePromise
  for (const [key, value] of Object.entries(result.headers)) {
    res.setHeader(key, value)
  }
  if (joined) console.timeEnd(timeLabel, 'inflight capture complete')
  return res.status(result.status).end(result.body)
})

async function shutdown (signal) {
  console.log(`${signal} received, shutting down`)
  await new Promise(resolve => server.close(resolve))
  await resetBrowser()
  process.exit(0)
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(signal, () => {
    shutdown(signal).catch(err => {
      console.error(err)
      process.exit(1)
    })
  })
}

const server = app.listen(port, () =>
  console.log(`Screenshot listen on http://:${port}`)
)
