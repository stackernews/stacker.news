const { createHash } = require('crypto')
const { readdirSync, readFileSync, statSync, writeFileSync, existsSync, renameSync } = require('fs')
const { join } = require('path')

const getRevision = filePath => createHash('md5').update(readFileSync(filePath)).digest('hex')
const walkSync = dir => readdirSync(dir, { withFileTypes: true }).flatMap(file =>
  file.isDirectory() ? walkSync(join(dir, file.name)) : join(dir, file.name))

function formatBytes (bytes, decimals = 2) {
  if (bytes === 0) {
    return '0 B'
  }

  const k = 1024
  const sizes = ['B', 'KB', 'MB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const formattedSize = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))

  return `${formattedSize} ${sizes[i]}`
}

function escapeForSingleQuotedJsString (str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\$/g, '\\$')
}

function generateDummyPrecacheManifest () {
  // A dummy manifest,to be easily referenced in the public/sw.js when patched
  // This will be pathced with custom assets urls after Next builds
  const manifest = [{
    url: '/dummy/path/test1.js',
    revision: 'rev-123'
  }]

  const output = join(__dirname, 'precache-manifest.json')
  writeFileSync(output, JSON.stringify(manifest, null, 2))

  console.log(`Created precache manifest at ${output}.`)
}

function patchSwAssetsURL (assetUrlsArray) {
  const fullPath = join(__dirname, '../public/sw.js')
  let content = readFileSync(fullPath, 'utf-8')
  const patchedArray = JSON.stringify(assetUrlsArray)
  const escapedPatchedArrayJson = escapeForSingleQuotedJsString(patchedArray)

  // Robust regex: matches JSON.parse('...') or JSON.parse("...") containing the dummy manifest
  // Looks for the dummy manifest's url and revision keys as a marker
  // This version does not use backreferences inside character classes
  const regex = /JSON\.parse\((['"])\s*\[\s*\{\s*(['"])url\2\s*:\s*(['"])[^'"]+\3\s*,\s*(['"])revision\4\s*:\s*(['"])[^'"]+\5\s*\}\s*\]\s*\1\)/

  if (!regex.test(content)) {
    console.warn('⚠️  No match found for precache manifest in sw.js. Service worker will NOT be patched.')
    return
  }

  content = content.replace(regex, () => {
    return `JSON.parse('${escapedPatchedArrayJson}')`
  })

  // Atomic write: write to temp file, then rename
  const tempPath = fullPath + '.tmp'
  try {
    writeFileSync(tempPath, content, 'utf-8')
    renameSync(tempPath, fullPath)
    console.log('✅ Patched service worker cached assets')
  } catch (err) {
    console.error('❌ Failed to patch service worker:', err)
    // Clean up temp file if exists
    if (existsSync(tempPath)) {
      try { require('fs').unlinkSync(tempPath) } catch (_) {}
    }
    throw err
  }
}

async function addStaticAssetsInServiceWorker () {
  const manifest = []
  let size = 0
  const addToManifest = (filePath, url, s) => {
    const revision = getRevision(filePath)
    manifest.push({ url, revision })
    size += s
  }

  const staticDir = join(__dirname, '../public')
  const staticFiles = walkSync(staticDir)
  const staticMatch = f => [/\.(gif|jpe?g|ico|png|ttf|woff|woff2)$/].some(m => m.test(f))
  staticFiles.filter(staticMatch).forEach(file => {
    const stats = statSync(file)
    // Normalize path separators for URLs
    const url = file.slice(staticDir.length).replace(/\\/g, '/')
    addToManifest(file, url, stats.size)
  })

  const pagesDir = join(__dirname, '../pages')
  const precacheURLs = ['/offline']
  const pagesFiles = walkSync(pagesDir)
  const fileToUrl = f => f.slice(pagesDir.length).replace(/\.js$/, '')
  const pageMatch = f => precacheURLs.some(url => fileToUrl(f) === url)
  pagesFiles.filter(pageMatch).forEach(file => {
    const stats = statSync(file)
    addToManifest(file, fileToUrl(file), stats.size)
  })

  const nextStaticDir = join(__dirname, '../.next/static')
  // Wait until folder is emitted
  console.log('⏳ Waiting for .next/static to be emitted...')
  let folderRetries = 0
  while (!existsSync(nextStaticDir) && folderRetries < 10) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 500))
    folderRetries++
  }

  if (!existsSync(nextStaticDir)) {
    // Still write the manifest with whatever was collected from public/ and pages/
    const output = join(__dirname, 'precache-manifest.json')
    writeFileSync(output, JSON.stringify(manifest, null, 2))
    console.warn(
      `⚠️ .next/static not found. Created precache manifest at ${output} with only public/ and pages/ assets.`
    )
    // Patch the service worker with the available manifest
    patchSwAssetsURL(manifest)
    return manifest
  }

  function snapshot (files) {
    return files.map(f => `${f}:${statSync(f).size}`).join(',')
  }
  // Now watch for stabilization (files are emitted asynchronously)
  let lastSnapshot = ''
  let stableCount = 0
  const maxWaitMs = 60000
  const startTime = Date.now()
  while (stableCount < 3 && (Date.now() - startTime) < maxWaitMs) {
    const files = walkSync(nextStaticDir)
    const currentSnapshot = snapshot(files)
    if (currentSnapshot === lastSnapshot) {
      stableCount++
    } else {
      lastSnapshot = currentSnapshot
      stableCount = 0
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  // finally generate manifest
  const nextStaticFiles = walkSync(nextStaticDir)
  nextStaticFiles.forEach(file => {
    const stats = statSync(file)
    // Normalize path separators for URLs
    const url = `/_next/static${file.slice(nextStaticDir.length).replace(/\\/g, '/')}`
    addToManifest(file, url, stats.size)
  })
  // write manifest
  const output = join(__dirname, 'precache-manifest.json')
  writeFileSync(output, JSON.stringify(manifest, null, 2))
  console.log(
    `✅ Created precache manifest at ${output}. Cache will include ${manifest.length} URLs with a size of ${formatBytes(size)}.`
  )
  const data = readFileSync(output, 'utf-8')
  const manifestArray = JSON.parse(data)
  patchSwAssetsURL(manifestArray)
}

module.exports = { generateDummyPrecacheManifest, addStaticAssetsInServiceWorker }
