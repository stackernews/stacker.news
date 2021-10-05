const { withPlausibleProxy } = require('next-plausible')
const { VersionLabel } = require('/opt/elasticbeanstalk/deployment/app_version_manifest.json') // eslint-disable-line

module.exports = withPlausibleProxy()({
  generateBuildId: async () => {
    return VersionLabel
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
