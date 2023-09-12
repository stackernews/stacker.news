const { gql } = require('graphql-tag')
const { sendOnAllNetworks } = require('./Send')

const excludedUsers = [9] // 9 is ads
const sentPosts = [] // TODO: move this to persistent storage
const MAX_HISTORY = 1000

exports.checkTrending = function ({ apollo }) {
  return async function () {
    console.log('checkTrending()')

    try {
      const { data: { items: { items } } } = await apollo.query({
        query: gql`
          query SubItems($sub: String, $sort: String, $cursor: String, $type: String, $name: String, $when: String, $by: String,$limit: Int) {
            items(sub: $sub, sort: $sort, cursor: $cursor, type: $type, name: $name, when: $when, by: $by, limit: $limit) {
              items {
                id
                userId
                title
              }
            }
          }`,
        variables: {
          sort: 'top',
          when: 'day',
          limit: 1
        }
      })

      if (items.length === 0) return

      const { id, userId, title } = items[0]

      if (sentPosts.includes(id)) return
      if (excludedUsers.includes(userId)) return

      const message = `
🔥 Trending on SN 🔥

${title}
https://stacker.news/items/${id}/r/sn
`

      await sendOnAllNetworks(message)

      sentPosts.unshift(id)
      sentPosts.splice(MAX_HISTORY, 1)
    } catch (err) {
      console.log(err)
    }
  }
}
