const { gql } = require('graphql-tag')
const { sendOnAllNetworks } = require('../lib/social')

exports.postTopStackers = function ({ apollo }) {
  return async function () {
    console.log('postTopStackers()')

    try {
      let users; let cursor = null
      do {
        ({ data: { topUsers: { cursor, users } } } = await apollo.query({
          query: gql`
            query TopUsers($cursor: String, $when: String, $by: String) {
              topUsers(cursor: $cursor, when: $when, by: $by) {
                cursor users { name stacked }
              }
            }`,
          variables: {
            cursor,
            when: 'week',
            by: 'stacked'
          }
        }))

        const numStackers = users.length
        let totalStacked = 0; users.map(e => (totalStacked += e.stacked))

        const message = `
This week ${numStackers} stackers earned ${totalStacked} sats, who topped this week's leaderboard?

🥇 ${users[0]?.name}: ${users[0]?.stacked}
🥈 ${users[1]?.name}: ${users[1]?.stacked}
🥉 ${users[2]?.name}: ${users[2]?.stacked}

Full leaderboard 👇

https://stacker.news/top/stackers/week/r/sn
`

        await sendOnAllNetworks(message)
      } while (cursor)
    } catch (err) {
      console.log(err)
    }
  }
}
