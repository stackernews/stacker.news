const { ApolloClient, InMemoryCache, HttpLink, gql } = require('@apollo/client')
const { quote } = require('../lib/md.js')
const { datePivot } = require('../lib/time.js')

const ITEMS = gql`
  query items ($sort: String, $when: String, $sub: String, $by: String, $from: String, $to: String) {
    items (sort: $sort, when: $when, sub: $sub, by: $by, from: $from, to: $to) {
      cursor
      items {
        id
        title
        url
        ncomments
        sats
        company
        status
        location
        remote
        boost
        subName
        user {
          id
          name
        }
      }
    }
  }
`

const TOP_COWBOYS = gql`
query TopCowboys($cursor: String) {
  topCowboys(cursor: $cursor) {
    users {
      name
      optional {
        streak
        hasSendWallet
        hasRecvWallet
      }
    }
    cursor
  }
}`

const TOP_USERS = gql`
  query TopUsers($cursor: String, $when: String, $from: String, $to: String, $by: String, ) {
    topUsers(cursor: $cursor, when: $when, from: $from, to: $to, by: $by) {
      users {
        name
        optional {
          stacked(when: $when, from: $from, to: $to)
          spent(when: $when, from: $from, to: $to)
        }
      }
      cursor
    }
  }
`

const client = new ApolloClient({
  link: new HttpLink({ uri: 'https://stacker.news/api/graphql' }),
  cache: new InMemoryCache()
})

const abbrNum = n => {
  if (n < 1e3) return n
  if (n >= 1e3 && n < 1e6) return +(n / 1e3).toFixed(1) + 'k'
  if (n >= 1e6 && n < 1e9) return +(n / 1e6).toFixed(1) + 'm'
  if (n >= 1e9 && n < 1e12) return +(n / 1e9).toFixed(1) + 'b'
  if (n >= 1e12) return +(n / 1e12).toFixed(1) + 't'
}

const SEARCH = gql`
query Search($q: String, $sort: String, $what: String, $when: String, $from: String, $to: String) {
  search(q: $q, sort: $sort, what: $what, when: $when, from: $from, to: $to) {
    items {
      id
      title
      bountyPaidTo
    }
  }
}`

const to = String(new Date(new Date().setHours(0, 0, 0, 0)).getTime())
const from = String(datePivot(new Date(Number(to)), { days: -8 }).getTime())

async function bountyWinner (q) {
  const WINNER = gql`
    query Item($id: ID!) {
      item(id: $id) {
        text
        sats
        imgproxyUrls
        user {
          name
        }
      }
    }`

  const bounty = await client.query({
    query: SEARCH,
    variables: { q: `${q} @sn`, sort: 'recent', what: 'posts', when: 'custom', from, to }
  })

  const items = bounty.data.search.items.filter(i => i.bountyPaidTo?.length > 0)
  if (items.length === 0) return

  try {
    const item = await client.query({
      query: WINNER,
      variables: { id: items[0].bountyPaidTo[0] }
    })

    const winner = { ...item.data.item, image: Object.values(item.data.item.imgproxyUrls)[0]?.['640w'] }

    return { bounty: items[0].id, winner }
  } catch (e) {

  }
}

async function getTopUsers ({ by, cowboys = false, includeHidden = false, count = 5, when = 'custom', from, to } = {}) {
  const accum = []
  let cursor = ''
  try {
    while (accum.length < count) {
      let variables = {
        cursor
      }
      if (!cowboys) {
        variables = {
          ...variables,
          by,
          when,
          from,
          to
        }
      }
      const result = await client.query({
        query: cowboys ? TOP_COWBOYS : TOP_USERS,
        variables
      })
      cursor = result.data[cowboys ? 'topCowboys' : 'topUsers'].cursor
      accum.push(...result.data[cowboys ? 'topCowboys' : 'topUsers'].users.filter(user => includeHidden ? true : !!user).filter(user => user.name !== 'k00b'))
    }
  } catch (e) {

  }
  return accum.slice(0, count)
}

async function main () {
  const top = await client.query({
    query: ITEMS,
    variables: { sort: 'top', when: 'custom', from, to }
  })

  const meta = await client.query({
    query: ITEMS,
    variables: { sort: 'top', when: 'custom', from, to, sub: 'meta' }
  })

  const ama = await client.query({
    query: ITEMS,
    variables: { sort: 'top', when: 'custom', from, to, sub: 'ama' }
  })

  const boosts = await client.query({
    query: ITEMS,
    variables: { sort: 'top', when: 'forever', by: 'boost' }
  })

  const topMeme = await bountyWinner('meme monday')
  const topFact = await bountyWinner('fun fact')

  const topCowboys = await getTopUsers({ cowboys: true, when: 'custom', from, to })
  const topStackers = await getTopUsers({ by: 'stacking', when: 'custom', from, to })
  const topSpenders = await getTopUsers({ by: 'spent', when: 'custom', from, to })

  process.stdout.write(
`Happy Sat-urday Stackers,

Have a great weekend!

##### Top Posts
${top.data.items.items.map((item, i) =>
  `${i + 1}. [${item.title}](https://stacker.news/items/${item.id})
    - ${abbrNum(item.sats)} sats${item.boost ? ` \\ ${abbrNum(item.boost)} boost` : ''} \\ ${item.ncomments} comments \\ [@${item.user.name}](https://stacker.news/${item.user.name})\n`).join('')}

##### Top AMAs
${ama.data.items.items.slice(0, 3).map((item, i) =>
  `${i + 1}. [${item.title}](https://stacker.news/items/${item.id})
    - ${abbrNum(item.sats)} sats${item.boost ? ` \\ ${abbrNum(item.boost)} boost` : ''} \\ ${item.ncomments} comments \\ [@${item.user.name}](https://stacker.news/${item.user.name})\n`).join('')}

[**all of this week's AMAs**](https://stacker.news/~AMA/top/posts/week)

##### Don't miss
${top.data.items.items.map((item, i) =>
  `- [${item.title}](https://stacker.news/items/${item.id})\n`).join('')}

[**all of this week's top posts**](https://stacker.news/top/posts/week)

-------

##### Top meta
${meta.data.items.items.slice(0, 10).map((item, i) =>
  `- [${item.title}](https://stacker.news/items/${item.id})\n`).join('')}

[**all of this week's meta**](https://stacker.news/~meta/top/posts/week)

-------

##### Top Monday meme
![](${new URL(topMeme?.winner.image, 'https://imgprxy.stacker.news').href})

[**all monday memes**](https://stacker.news/items/${topMeme?.bounty})

------

##### Top Friday fun fact
${topFact && quote(topFact?.winner.text)}

[**all friday fun facts**](https://stacker.news/items/${topFact?.bounty})

------

##### Top Stackers
${topStackers.map((user, i) =>
    `${i + 1}. [@${user.name}](https://stacker.news/${user.name}): ${abbrNum(user.optional.stacked)} sats stacked`
).join('\n')}

------

##### Top Spenders
${topSpenders.map((user, i) =>
    `${i + 1}. [@${user.name}](https://stacker.news/${user.name}): ${abbrNum(user.optional.spent)} sats spent`
).join('\n')}

------

##### Top Cowboys
${topCowboys.map((user, i) =>
  `${i + 1}. [@${user.name}](https://stacker.news/${user.name}): ${user.optional.streak} days`
).join('\n')}

------

##### Top Boosts
${boosts.data.items.items.map((item, i) =>
  item.subName === 'jobs'
  ? `${i + 1}. [${item.title.trim()} \\ ${item.company} \\ ${item.location}${item.remote ? ' or Remote' : ''}](https://stacker.news/items/${item.id})\n`
  : `${i + 1}. [${item.title.trim()}](https://stacker.news/items/${item.id})\n`
  ).join('')}

[**all active boosts**](https://stacker.news/top/boosts/month?by=boost)

------

Yeehaw,
Keyan
A guy who works on Stacker News

[Watch](https://www.youtube.com/@stackernews/live) or [Listen](https://www.fountain.fm/show/Mg1AWuvkeZSFhsJZ3BW2) to SN's top stories every week.

Get this newsletter sent to your email inbox by signing up [here](https://mail.stacker.news/subscription/form).`)
}

main()
