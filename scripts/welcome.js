#!/usr/bin/env node

function usage () {
  console.log('Usage: scripts/welcome.js <fetch-after> [--prod]')
  process.exit(1)
}

let args = process.argv.slice(2)

const useProd = args.indexOf('--prod') !== -1
const SN_API_URL = useProd ? 'https://stacker.news' : 'http://localhost:3000'
args = args.filter(arg => arg !== '--prod')
console.log('> url:', SN_API_URL)

// this is the item id of the last bio that was included in the previous post of the series
const FETCH_AFTER = args[0]
console.log('> fetch-after:', FETCH_AFTER)
if (!FETCH_AFTER) {
  usage()
}

const SN_API_KEY = process.env.SN_API_KEY
if (!SN_API_KEY) {
  console.log('SN_API_KEY must be set in environment')
  process.exit(1)
}

const LIMIT = 50

async function gql (query, variables = {}) {
  const response = await fetch(`${SN_API_URL}/api/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': SN_API_KEY },
    body: JSON.stringify({ query, variables })
  })

  if (response.status !== 200) {
    throw new Error(`request failed: ${response.statusText}`)
  }

  const json = await response.json()
  if (json.errors) {
    throw new Error(json.errors[0].message)
  }

  return json.data
}

async function assertSettings () {
  const { me } = await gql(`
    query me {
      me {
        id
        name
        privates {
          wildWestMode
          satsFilter
        }
      }
    }
  `)

  console.log(`> logged in as @${me.name}`)

  if (!me.privates.wildWestMode) {
    throw new Error('wild west mode must be enabled')
  }

  if (me.privates.satsFilter !== 0) {
    throw new Error('sats filter must be set to 0')
  }
}

async function fetchData () {
  return await Promise.all([
    fetchLatestWelcomePost(),
    fetchRecentBios()
  ])
}

async function fetchLatestWelcomePost () {
  const { items: { items } } = await gql(
    `query LatestWelcomePost {
      items(name: "ek", sort: "user", type: "posts", limit: 50) {
        items {
          id
          title
          text
        }
      }
    }`)

  const regex = /Baby Stacker Corner/i
  for (const item of items) if (regex.test(item.title)) return item
  throw new Error('latest welcome post not found')
}

async function fetchRecentBios () {
  // fetch all recent bios. we assume here there won't be more than 21
  // since the last bio we already included in a post as defined by FETCH_AFTER.
  const { items: { items: bios } } = await gql(
    `query NewBios($limit: Limit!) {
      items(sort: "recent", type: "bios", limit: $limit) {
        items {
          id
          title
          createdAt
          user {
            name
            since
            nitems
            optional {
              stacked
            }
          }
        }
      }
    }`, { limit: LIMIT }
  )

  // assert that we fetched enough bios
  const newBios = bios.filter(b => b.id > FETCH_AFTER)
  if (newBios.length === bios.length) {
    throw new Error('last bio not found. increase limit')
  }
  return newBios
}

async function populate (data) {
  const [welcomePost, bios] = data
  return await Promise.all([
    welcomePost,
    Promise.all(
      bios.map(
        async bio => {
          bio.user.since = await util.fetchItem(bio.user.since)
          bio.user.items = await util.fetchUserItems(bio.user.name)
          bio.user.credits = util.sumBy(bio.user.items, 'credits')
          bio.user.sats = util.sumBy(bio.user.items, 'sats') - bio.user.credits
          if (bio.user.sats > 0 || bio.user.credits > 0) {
            bio.user.satstandard = bio.user.sats / (bio.user.sats + bio.user.credits)
          } else {
            bio.user.satstandard = 0
          }
          return bio
        }
      )
    )
  ])
}

function printIntro (data) {
  const [welcomePost, bios] = data

  console.log(`> latest welcome post: ${welcomePost.title}`)
  const nr = Number(welcomePost.title.match(/\d+/)[0])

  console.log(`\n# Baby Stacker Corner #${nr + 1}\n`)

  let series = welcomePost.text.split('\n').filter(line => line.startsWith('whole series:'))[0]
  series += `, [#${nr}](${util.itemLink(welcomePost.id)})\n`
  console.log(series)

  console.log(`${bios.length} new stackers have found their way to Stacker News this week!\n`)
  console.log('Questions for the new stackers:')
  console.log('- How did you find out about SN?')
  console.log('- How difficult was it to get started? Any feedback?')
  console.log('- How much experience do you have with lightning?')
  console.log('- Have you read the [FAQ](https://stacker.news/faq) already?')
  console.log('- Have you realized that you need to attach a wallet to receive sats?')
  console.log('- How was your first week on SN?\n')

  return data
}

async function printTable (data) {
  const [, bios] = data

  console.log('| nym | bio (stacking since) | items | sats/ccs stacked | sat standard |')
  console.log('| --- | -------------------- | ----- | ---------------- | ------------ |')

  for (const bio of bios) {
    const { user } = bio

    const bioCreatedAt = util.formatDate(bio.createdAt)
    let col2 = util.dateLink(bio)
    if (Number(bio.id) !== user.since.id) {
      const sinceCreatedAt = util.formatDate(user.since.createdAt)
      // stacking since might not be the same item as the bio
      // but it can still have been created on the same day
      if (bioCreatedAt !== sinceCreatedAt) {
        col2 += ` (${util.dateLink(user.since)})`
      }
    }
    console.log(`| @${user.name} | ${col2} | ${user.nitems} | ${user.sats}/${user.credits} | ${user.satstandard.toFixed(2)} |`)
  }

  return data
}

function printOutro (data) {
  console.log('\n_sat standard = ratio of received sats vs credits (`sats/(sats+credits)`)_\n')

  console.log('Questions for the old stackers:')
  console.log('- Anyone in there who you want to point out?')
  console.log('- Do you know better questions I could ask the new stackers or you?\n')

  console.log('<<< INSERT MEME HERE >>>')
  console.log('inspiration: https://imgflip.com/memetemplates?sort=top-new')

  return data
}
const util = {
  formatDate (date) {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  },
  sumBy (arr, key) {
    return arr.reduce((acc, item) => acc + item[key], 0)
  },
  itemLink (id) {
    return `https://stacker.news/items/${id}`
  },
  dateLink (item) {
    return `[${this.formatDate(item.createdAt)}](${this.itemLink(item.id)})`
  },
  async fetchItem (id) {
    const data = await gql(`
      query Item($id: ID!) {
        item(id: $id) {
          id
          createdAt
        }
      }`, { id }
    )
    return data.item
  },
  async fetchUserItems (name) {
    const data = await gql(`
      query UserItems($name: String!) {
        items(sort: "user", type: "all", limit: 999, name: $name) {
          items {
            id
            createdAt
            sats
            credits
          }
        }
      }`, { name }
    )
    return data.items.items
  }
}

assertSettings()
  .then(fetchData)
  .then(printIntro)
  .then(populate)
  .then(printTable)
  .then(printOutro)
  .catch(console.error)
