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

// XXX this fragile ... eb could change the version label ... but it works for now
const commitHash = isProd
  ? Object.keys(require('/opt/elasticbeanstalk/deployment/app_version_manifest.json').RuntimeSources['stacker.news'])[0].match(/^app-(.+)-/)[1] // eslint-disable-line
  : require('child_process').execSync('git rev-parse HEAD').toString().slice(0, 4)

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
        source: '/_next/:asset*',
        headers: corsHeaders
      },
      {
        source: '/darkmode.js',
        headers: [
          ...corsHeaders
        ]
      },
      {
        source: '/Lightningvolt-xoqm.ttf',
        headers: [
          ...corsHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        source: '/.well-known/:slug*',
        headers: [
          ...corsHeaders
        ]
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
      }
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
  webpack: (config, { isServer }) => {
    if (isServer) {
      generatePrecacheManifest()
      config.plugins.push(
        new InjectManifest({
          // ignore the precached manifest which includes the webpack assets
          // since they are not useful to us
          exclude: [/.*/],
          // by default, webpack saves service worker at .next/server/
          swDest: '../../public/sw.js',
          swSrc: './sw/index.js'
        })
      )
    }
    return config
  }
})
