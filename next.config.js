const { withPlausibleProxy } = require('next-plausible')

module.exports = withPlausibleProxy()({
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
