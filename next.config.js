const { withPlausibleProxy } = require('next-plausible')

module.exports = withPlausibleProxy()({
  compress: false,
  generateBuildId: async () => {
    // use the app version which eb doesn't otherwise give us
    // as the build id
    const { RuntimeSources } = require('/opt/elasticbeanstalk/deployment/app_version_manifest.json') // eslint-disable-line
    return Object.keys(RuntimeSources['stacker.news'])[0]
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
  }
})
