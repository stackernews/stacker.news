const { gql } = require('graphql-tag')
const { sendOnAllNetworks } = require('./Send')

const threshold = 125000

exports.checkRewards = function ({ apollo }) {
  return async function () {
    console.log('checkRewards()')

    try {
      const { data: { rewards: [{ total }] } } = await apollo.query({
        query: gql`{ rewards { total } }`
      })

      if (total < threshold) return

      const message = `
In 8 hours, we're giving away over ${total} sats to all the best zappers on Stacker News!

https://stacker.news/rewards/r/sn
`

      await sendOnAllNetworks(message)
    } catch (err) {
      console.log(err)
    }
  }
}
