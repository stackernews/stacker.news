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

function fetchRecentBios () {
  // fetch all recent bios. we assume here there won't be more than 21
  // since the last bio we already included in a post as defined by FETCH_AFTER.
  return gql(
    `query NewBios {
      items(sort: "recent", type: "bios", limit: 21) {
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
    }`
  )
}

function filterBios (bios) {
  const newBios = bios.filter(b => b.id > FETCH_AFTER)
  if (newBios.length === bios.length) {
    throw new Error('last bio not found. increase limit')
  }
  return newBios
}

async function populate (bios) {
  return await Promise.all(
    bios.map(
      async bio => {
        bio.user.since = await fetchItem(bio.user.since)
        bio.user.items = await fetchUserItems(bio.user.name)
        bio.user.credits = sumBy(bio.user.items, 'credits')
        bio.user.sats = sumBy(bio.user.items, 'sats') - bio.user.credits
        if (bio.user.sats > 0 || bio.user.credits > 0) {
          bio.user.satstandard = bio.user.sats / (bio.user.sats + bio.user.credits)
        } else {
          bio.user.satstandard = 0
        }
        return bio
      }
    )
  )
}

async function printTable (bios) {
  console.log('| nym | bio (stacking since) | items | sats/ccs stacked | sat standard |')
  console.log('| --- | -------------------- | ----- | ---------------- | ------------ |')

  for (const bio of bios) {
    const { user } = bio

    const bioCreatedAt = formatDate(bio.createdAt)
    let col2 = dateLink(bio)
    if (Number(bio.id) !== user.since.id) {
      const sinceCreatedAt = formatDate(user.since.createdAt)
      // stacking since might not be the same item as the bio
      // but it can still have been created on the same day
      if (bioCreatedAt !== sinceCreatedAt) {
        col2 += ` (${dateLink(user.since)})`
      }
    }
    console.log(`| @${user.name} | ${col2} | ${user.nitems} | ${user.sats}/${user.credits} | ${user.satstandard.toFixed(2)} |`)
  }

  console.log(`${bios.length} rows`)

  return bios
}

function formatDate (date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function sumBy (arr, key) {
  return arr.reduce((acc, item) => acc + item[key], 0)
}

function itemLink (id) {
  return `https://stacker.news/items/${id}`
}

function dateLink (item) {
  return `[${formatDate(item.createdAt)}](${itemLink(item.id)})`
}

async function fetchItem (id) {
  const data = await gql(`
    query Item($id: ID!) {
      item(id: $id) {
        id
        createdAt
      }
    }`, { id }
  )
  return data.item
}

async function fetchUserItems (name) {
  const data = await gql(`
    query UserItems($name: String!) {
      items(sort: "user", name: $name) {
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

assertSettings()
  .then(fetchRecentBios)
  .then(data => filterBios(data.items.items))
  .then(populate)
  .then(printTable)
  .catch(console.error)
