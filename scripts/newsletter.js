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
  if (n < 1e4) return n
  if (n >= 1e4 && n < 1e6) return +(n / 1e3).toFixed(1) + 'k'
  if (n >= 1e6 && n < 1e9) return +(n / 1e6).toFixed(1) + 'm'
  if (n >= 1e9 && n < 1e12) return +(n / 1e9).toFixed(1) + 'b'
  if (n >= 1e12) return +(n / 1e12).toFixed(1) + 't'
}

async function main () {
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

  process.stdout.write(
`Happy Sat-urday Stackers,

Have a great weekend!

##### Top Posts
${top.data.items.items.slice(0, 10).map((item, i) =>
  `${i + 1}. [${item.title}](https://stacker.news/items/${item.id})${item.url ? `\n    - ${item.url}` : ''}
    - ${abbrNum(item.sats)} sats${item.boost ? ` \\ ${abbrNum(item.boost)} boost` : ''} \\ ${item.ncomments} comments\n`).join('')}

##### Don't miss
${top.data.items.items.slice(0, 15).map((item, i) =>
  `- [${item.title}](https://stacker.news/items/${item.id})\n`).join('')}

##### Top meta
${meta.data.items.items.slice(0, 10).map((item, i) =>
  `- [${item.title}](https://stacker.news/items/${item.id})\n`).join('')}

[**all of this week's top posts**](https://stacker.news/top/posts/week)

##### Promoted jobs
${jobs.data.items.items.filter(i => i.maxBid > 0 && i.status === 'ACTIVE').slice(0, 5).map((item, i) =>
  `${i + 1}. [${item.title.trim()} \\ ${item.company} \\ ${item.location}${item.remote ? ' or Remote' : ''}](https://stacker.news/items/${item.id})\n`).join('')}

[**all jobs**](https://stacker.news/~jobs)

Yeehaw,
Keyan
A guy who works on Stacker News

[Watch](https://www.youtube.com/@stackernews/live) or [Listen](https://www.fountain.fm/show/Mg1AWuvkeZSFhsJZ3BW2) to SN's top stories every week.`)
}

main()
