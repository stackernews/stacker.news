const { createHash } = require('crypto');
const { existsSync, readdirSync, readFileSync, statSync, writeFileSync } = require('fs');
const { join } = require('path');

const getRevision = filePath => createHash('md5').update(readFileSync(filePath)).digest('hex');
const walkSync = dir => readdirSync(dir, { withFileTypes: true }).flatMap(file =>
  file.isDirectory() ? walkSync(join(dir, file.name)) : join(dir, file.name)
);

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) {
    return '0 B';
  }

  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const formattedSize = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));

  return `${formattedSize} ${sizes[i]}`;
}

function createEmptyPrecacheManifest() {
  const manifestPath = join('sw/precache-manifest.json');
  writeFileSync(manifestPath, '[]');
  console.log(`✅ Created empty precache-manifest.json at ${manifestPath}`);
}

async function generatePrecacheManifest() {
  const manifest = [];
  let size = 0;

  const addToManifest = (filePath, url, s) => {
    const revision = getRevision(filePath);
    manifest.push({ url, revision });
    size += s;
  };

  const staticDir = join(__dirname, '../public');
  const staticFiles = walkSync(staticDir);
  const staticMatch = f => [/\.(gif|jpe?g|ico|png|ttf|woff|woff2)$/].some(m => m.test(f));
  staticFiles.filter(staticMatch).forEach(file => {
    const stats = statSync(file);
    // Normalize path separators for URLs
    const url = file.slice(staticDir.length).replace(/\\/g, '/');
    addToManifest(file, url, stats.size);
  });

  const pagesDir = join(__dirname, '../pages');
  const precacheURLs = ['/offline'];
  const pagesFiles = walkSync(pagesDir);
  const fileToUrl = f => f.slice(pagesDir.length).replace(/\.js$/, '');
  const pageMatch = f => precacheURLs.some(url => fileToUrl(f) === url);
  pagesFiles.filter(pageMatch).forEach(file => {
    const stats = statSync(file);
    addToManifest(file, fileToUrl(file), stats.size);
  });

  const nextStaticDir = join(__dirname, '../.next/static');

  // Wait until folder is emitted
  console.log('⏳ Waiting for .next/static to be emitted...');
  let folderRetries = 0;
  while (!existsSync(nextStaticDir) && folderRetries < 10) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 500));
    folderRetries++;
  }

  if (!existsSync(nextStaticDir)) {
    // Still write the manifest with whatever was collected from public/ and pages/
    const output = 'sw/precache-manifest.json';
    writeFileSync(output, JSON.stringify(manifest, null, 2));
    console.warn(
      `⚠️ .next/static not found. Created precache manifest at ${output} with only public/ and pages/ assets.`
    );
    return;
  }

  // Now watch for stabilization (files are emitted asynchronously)
  let lastFileCount = 0;
  let stableCount = 0;

  const maxWaitMs = 60000;
  const startTime = Date.now();
  while (stableCount < 3 && (Date.now() - startTime) < maxWaitMs) {
    const files = walkSync(nextStaticDir);
    if (files.length === lastFileCount) {
      stableCount++;
    } else {
      stableCount = 0;
      lastFileCount = files.length;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // finally generate manifest
  const nextStaticFiles = walkSync(nextStaticDir);
  nextStaticFiles.forEach(file => {
    const stats = statSync(file);
    // Normalize path separators for URLs
    const url = `/_next/static${file.slice(nextStaticDir.length).replace(/\\/g, '/')}`;
    addToManifest(file, url, stats.size);
  });

  // write manifest
  const output = 'sw/precache-manifest.json';
  writeFileSync(output, JSON.stringify(manifest, null, 2));

  console.log(
    `✅ Created precache manifest at ${output}. Cache will include ${manifest.length} URLs with a size of ${formatBytes(size)}.`
  );
}

module.exports = { createEmptyPrecacheManifest, generatePrecacheManifest };
