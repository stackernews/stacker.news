const { withPlausibleProxy } = require('next-plausible')

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

module.exports = withPlausibleProxy()({
  compress: false,
  experimental: {
    scrollRestoration: true
  },
  generateBuildId: process.env.NODE_ENV === 'development'
    ? undefined
    : async () => {
    // use the app version which eb doesn't otherwise give us
    // as the build id
      const { RuntimeSources } = require('/opt/elasticbeanstalk/deployment/app_version_manifest.json') // eslint-disable-line
      return Object.keys(RuntimeSources['stacker.news'])[0]
    },
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
