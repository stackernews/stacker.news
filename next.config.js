const { withPlausibleProxy } = require('next-plausible')

const isProd = process.env.NODE_ENV === 'production'
const corsHeaders = [
  {
    key: 'Access-Control-Allow-Origin',
    value: isProd ? 'https://stacker.news' : 'http://localhost:3000'
  },
  {
    key: 'Access-Control-Allow-Methods',
    value: 'GET, PUT, POST, DELETE, HEAD, OPTIONS'
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
  assetPrefix: isProd ? 'https://a.stacker.news' : '',
  async headers () {
    return [
      {
        source: '/_next/:asset*',
        headers: corsHeaders
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
        source: '/.well-known/lnurlp/:username',
        destination: '/api/lnurlp/:username'
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
