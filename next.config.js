const { withPlausibleProxy } = require('next-plausible')
const { InjectManifest } = require('workbox-webpack-plugin')
const { generatePrecacheManifest } = require('./sw/build')

const isProd = process.env.NODE_ENV === 'production'
const corsHeaders = [
  {
    key: 'Access-Control-Allow-Origin',
    value: '*'
  },
  {
    key: 'Access-Control-Allow-Methods',
    value: 'GET, HEAD, OPTIONS'
  }
]

let commitHash
if (isProd) {
  // XXX this fragile ... eb could change the version label ... but it works for now
  commitHash = Object.keys(require('/opt/elasticbeanstalk/deployment/app_version_manifest.json').RuntimeSources['stacker.news'])[0].match(/^app-(.+)-/)[1] // eslint-disable-line
} else {
  try {
    commitHash = require('child_process').execSync('git rev-parse HEAD').toString().slice(0, 4)
  } catch (e) {
    console.log('could not get commit hash with `git rev-parse HEAD` ... using 0000')
    commitHash = '0000'
  }
}

module.exports = withPlausibleProxy()({
  env: {
    NEXT_PUBLIC_COMMIT_HASH: commitHash,
    NEXT_PUBLIC_LND_CONNECT_ADDRESS: process.env.LND_CONNECT_ADDRESS,
    NEXT_PUBLIC_ASSET_PREFIX: isProd ? 'https://a.stacker.news' : ''
  },
  compress: false,
  experimental: {
    scrollRestoration: true
  },
  reactStrictMode: true,
  generateBuildId: isProd ? async () => commitHash : undefined,
  // Use the CDN in production and localhost for development.
  assetPrefix: isProd ? 'https://a.stacker.news' : undefined,
  crossOrigin: isProd ? 'anonymous' : undefined,
  async headers () {
    return [
      {
        source: '/',
        headers: [
          {
            // This tells the browser to send this client hint in subsequent requests
            // Only added to the "/" path since that's what is initially loaded for the PWA
            key: 'Accept-CH',
            value: 'Sec-CH-Prefers-Color-Scheme'
          }
        ]
      },
      {
        source: '/_next/:asset*',
        headers: corsHeaders
      },
      {
        source: '/.well-known/:slug*',
        headers: [
          ...corsHeaders
        ]
      },
      // never cache service worker
      // https://stackoverflow.com/questions/38843970/service-worker-javascript-update-frequency-every-24-hours/38854905#38854905
      {
        source: '/sw.js',
        headers: [{
          key: 'Cache-Control',
          value: 'no-cache'
        }]
      },
      {
        source: '/api/lnauth',
        headers: [
          ...corsHeaders
        ]
      },
      {
        source: '/api/lnurlp/:slug*',
        headers: [
          ...corsHeaders
        ]
      },
      {
        source: '/api/lnwith',
        headers: [
          ...corsHeaders
        ]
      },
      ...['tff', 'woff', 'woff2'].map(ext => ({
        source: `/Lightningvolt-xoqm.${ext}`,
        headers: [
          ...corsHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }))
    ]
  },
  async rewrites () {
    return [
      {
        source: '/faq',
        destination: '/items/349'
      },
      {
        source: '/story',
        destination: '/items/1620'
      },
      {
        source: '/privacy',
        destination: '/items/76894'
      },
      {
        source: '/changes',
        destination: '/items/78763'
      },
      {
        source: '/guide',
        destination: '/items/81862'
      },
      {
        source: '/daily',
        destination: '/api/daily'
      },
      {
        source: '/.well-known/lnurlp/:username',
        destination: '/api/lnurlp/:username'
      },
      {
        source: '/.well-known/nostr.json',
        destination: '/api/nostr/nip05'
      },
      {
        source: '/.well-known/web-app-origin-association',
        destination: '/api/web-app-origin-association'
      },
      {
        source: '/~:sub/:slug*\\?:query*',
        destination: '/~/:slug*?:query*&sub=:sub'
      },
      {
        source: '/~:sub/:slug*',
        destination: '/~/:slug*?sub=:sub'
      },
      ...['/', '/post', '/search', '/rss', '/recent/:slug*', '/top/:slug*'].map(source => ({ source, destination: '/~' + source }))
    ]
  },
  async redirects () {
    return [
      {
        source: '/statistics',
        destination: '/satistics?inc=invoice,withdrawal',
        permanent: true
      }
    ]
  },
  webpack: (config, { isServer, dev }) => {
    if (isServer) {
      generatePrecacheManifest()
      const workboxPlugin = new InjectManifest({
        // ignore the precached manifest which includes the webpack assets
        // since they are not useful to us
        exclude: [/.*/],
        // by default, webpack saves service worker at .next/server/
        swDest: '../../public/sw.js',
        swSrc: './sw/index.js'
      })
      if (dev) {
        // Suppress the "InjectManifest has been called multiple times" warning by reaching into
        // the private properties of the plugin and making sure it never ends up in the state
        // where it makes that warning.
        // https://github.com/GoogleChrome/workbox/blob/v6/packages/workbox-webpack-plugin/src/inject-manifest.ts#L260-L282
        Object.defineProperty(workboxPlugin, 'alreadyCalled', {
          get () {
            return false
          },
          set () {
            // do nothing; the internals try to set it to true, which then results in a warning
            // on the next run of webpack.
          }
        })
      }

      config.plugins.push(workboxPlugin)
    }
    return config
  }
})
