const { withPlausibleProxy } = require('next-plausible')
const withPWA = require('next-pwa')
const defaultRuntimeCaching = require('next-pwa/cache')

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

console.log([
  {
    urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
    handler: 'NetworkFirst',
    options: {
      cacheName: 'next-data',
      expiration: {
        maxEntries: 32,
        maxAgeSeconds: 24 * 60 * 60 // 24 hours
      }
    }
  },
  ...defaultRuntimeCaching.filter((c) => c.options.cacheName !== 'next-data')
])

// XXX this fragile ... eb could change the version label ... but it works for now
const commitHash = isProd
  ? Object.keys(require('/opt/elasticbeanstalk/deployment/app_version_manifest.json').RuntimeSources['stacker.news'])[0].match(/^app-(.+)-/)[1] // eslint-disable-line
  : require('child_process').execSync('git rev-parse HEAD').toString().slice(0, 4)

module.exports = withPWA({
  dest: 'public',
  register: true,
  customWorkerDir: 'sw',
  runtimeCaching: [
    {
      urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'next-data',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60 // 24 hours
        }
      }
    },
    ...defaultRuntimeCaching.filter((c) => c.options.cacheName !== 'next-data')
  ]
})(
  withPlausibleProxy()({
    env: {
      NEXT_PUBLIC_COMMIT_HASH: commitHash
    },
    compress: false,
    experimental: {
      scrollRestoration: true
    },
    generateBuildId: isProd ? async () => commitHash : undefined,
    // Use the CDN in production and localhost for development.
    assetPrefix: isProd ? 'https://a.stacker.news' : undefined,
    async headers () {
      return [
        {
          source: '/_next/:asset*',
          headers: corsHeaders
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
          source: '/~:sub',
          destination: '/~/:sub'
        },
        {
          source: '/~:sub/:slug*',
          destination: '/~/:sub/:slug*'
        }
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
    }
  })
)
