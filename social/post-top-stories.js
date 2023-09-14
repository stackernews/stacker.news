const { gql } = require('graphql-tag')
const { sendOnAllNetworks } = require('../lib/social')

const max = 100000

exports.postTopStories = function ({ apollo }) {
  return async function () {
    console.log('postTopStories()')

    try {
      const { data: { items: { items: posts } } } = await apollo.query({
        query: gql`
          query SubItems($sub: String, $sort: String, $cursor: String, $type: String, $name: String, $when: String, $by: String, $limit: Int) {
            items(sub: $sub, sort: $sort, cursor: $cursor, type: $type, name: $name, when: $when, by: $by, limit: $limit) {
              items { id }
            }
          }`,
        variables: {
          sort: 'top',
          when: 'week',
          limit: max
        }
      })

      const numPosts = posts.length

      const { data: { items: { items: posters } } } = await apollo.query({
        query: gql`
          query SubItems($sub: String, $sort: String, $cursor: String, $type: String, $name: String, $when: String, $by: String, $limit: Int) {
            items(sub: $sub, sort: $sort, cursor: $cursor, type: $type, name: $name, when: $when, by: $by, limit: $limit) {
              items { userId }
            }
          }`,
        variables: {
          sort: 'top',
          when: 'week',
          limit: max
        }
      })

      const numPosters = new Set(posters.map(item => item.userId)).size

      const message = `
This week ${numPosters} stackers created ${numPosts} Stacker News posts, catch up on all the top stories from the last week!

https://stacker.news/top/posts/week/r/sn
`

      await sendOnAllNetworks(message)
    } catch (err) {
      console.log(err)
    }
  }
}
