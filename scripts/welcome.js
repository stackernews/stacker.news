#!/usr/bin/env node

const SN_API_URL = process.env.SN_API_URL ?? 'http://localhost:3000'
// this is the item id of the last bio that was included in the previous post of the series
// TODO: make this configurable
const FETCH_AFTER = 838433

async function gql (query, variables = {}) {
  const response = await fetch(`${SN_API_URL}/api/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

async function printTable (bios) {
  console.log('| nym | bio (stacking since) | items | sats stacked |')
  console.log('| --- | -------------------- | ----- | ------------ |')

  for (const bio of bios) {
    const { user } = bio

    const bioCreatedAt = formatDate(bio.createdAt)
    let col2 = `[${formatDate(bio.createdAt)}](${itemLink(bio.id)})`
    if (Number(bio.id) !== user.since) {
      const since = await fetchItem(user.since)
      const sinceCreatedAt = formatDate(since.createdAt)
      // stacking since might not be the same item as the bio
      // but it can still have been created on the same day
      if (bioCreatedAt !== sinceCreatedAt) {
        col2 += ` ([${formatDate(since.createdAt)}](${itemLink(since.id)}))`
      }
    }
    console.log(`| @${user.name} | ${col2} | ${user.nitems} | ${user.optional.stacked || '???'} |`)
  }

  console.log(`${bios.length} rows`)

  return bios
}

function formatDate (date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function itemLink (id) {
  return `https://stacker.news/items/${id}`
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

fetchRecentBios()
  .then(data => filterBios(data.items.items))
  .then(printTable)
  .catch(console.error)
