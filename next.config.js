const { withPlausibleProxy } = require('next-plausible')
const data = require('/opt/elasticbeanstalk/deployment/app_version_manifest.json') // eslint-disable-line

console.log(data)

module.exports = withPlausibleProxy()({
  generateBuildId: async () => {
    return data.VersionLabel
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
