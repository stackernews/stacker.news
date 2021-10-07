const { withPlausibleProxy } = require('next-plausible')
const { RuntimeSources } = require('/opt/elasticbeanstalk/deployment/app_version_manifest.json') // eslint-disable-line

module.exports = withPlausibleProxy()({
  compress: false,
  generateBuildId: async () => {
    // use the app version which eb doesn't otherwise give us
    // as the build id
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
      }
    ]
  }
})
