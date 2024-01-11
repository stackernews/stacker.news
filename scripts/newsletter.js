const { ApolloClient, InMemoryCache, HttpLink, gql } = require('@apollo/client')

const ITEMS = gql`
  query items ($sort: String, $when: String, $sub: String) {
    items (sort: $sort, when: $when, sub: $sub) {
      cursor
      items {
        id
        title
        url
        ncomments
        sats
        company
        maxBid
        status
        location
        remote
        boost
        user {
          id
          name
        }
      }
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

async function bountyWinner (q) {
  const BOUNTY = gql`
  query Search($q: String, $sort: String, $what: String, $when: String) {
    search(q: $q, sort: $sort, what: $what, when: $when) {
      items {
        id
        bountyPaidTo
      }
    }
  }`

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
    query: BOUNTY,
    variables: { q: `${q} nym:sn`, sort: 'recent', what: 'posts', when: 'week' }
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

async function main () {
  const { quote } = await import('../lib/md.js')

  const top = await client.query({
    query: ITEMS,
    variables: { sort: 'top', when: 'week' }
  })

  const meta = await client.query({
    query: ITEMS,
    variables: { sort: 'top', when: 'week', sub: 'meta' }
  })

  const jobs = await client.query({
    query: ITEMS,
    variables: { sub: 'jobs' }
  })

  const topMeme = await bountyWinner('monday meme')
  const topFact = await bountyWinner('fun fact')

  process.stdout.write(
`Happy Sat-urday Stackers,

Have a great weekend!

##### Top Posts
${top.data.items.items.slice(0, 10).map((item, i) =>
  `${i + 1}. [@${item.user.name}](https://stacker.news/${item.user.name}) [${item.title}](https://stacker.news/items/${item.id})
    - [${item.title}](https://stacker.news/items/${item.id})
      - ${abbrNum(item.sats)} sats${item.boost ? ` \\ ${abbrNum(item.boost)} boost` : ''} \\ ${item.ncomments} comments \\ [@${item.user.name}](https://stacker.news/${item.user.name})\n`).join('')}

##### Don't miss
${top.data.items.items.map((item, i) =>
  `- [${item.title}](https://stacker.news/items/${item.id})\n`).join('')}

[**all of this week's top posts**](https://stacker.news/top/posts/week)

-------

##### Top meta
${meta.data.items.items.slice(0, 10).map((item, i) =>
  `- [${item.title}](https://stacker.news/items/${item.id})\n`).join('')}

-------

##### Top Monday meme \\ ${abbrNum(topMeme?.winner.sats)} sats \\ [@${topMeme?.winner.user.name}](https://stacker.news/${topMeme?.winner.user.name})
![](${topMeme?.winner.image})

[**all monday memes**](https://stacker.news/items/${topMeme?.bounty})

------

##### Top Friday fun fact \\ ${abbrNum(topFact?.winner.sats)} sats \\ [@${topFact?.winner.user.name}](https://stacker.news/${topFact?.winner.user.name})
${quote(topFact?.winner.text)}

[**all friday fun facts**](https://stacker.news/items/${topFact.bounty})

------

##### Promoted jobs
${jobs.data.items.items.filter(i => i.maxBid > 0 && i.status === 'ACTIVE').slice(0, 5).map((item, i) =>
  `${i + 1}. [${item.title.trim()} \\ ${item.company} \\ ${item.location}${item.remote ? ' or Remote' : ''}](https://stacker.news/items/${item.id})\n`).join('')}

[**all jobs**](https://stacker.news/~jobs)

------

Yeehaw,
Keyan
A guy who works on Stacker News

[Watch](https://www.youtube.com/@stackernews/live) or [Listen](https://www.fountain.fm/show/Mg1AWuvkeZSFhsJZ3BW2) to SN's top stories every week.

Get this newsletter sent to your email inbox by signing up [here](https://mail.stacker.news/subscription/form).`)
}

main()
