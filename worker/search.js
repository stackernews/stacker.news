const { gql } = require('apollo-server-micro')
const es = require('@opensearch-project/opensearch')

const search = new es.Client({ node: 'http://localhost:9200' })

const ITEM_SEARCH_FIELDS = gql`
  fragment ItemSearchFields on Item {
    id
    parentId
    createdAt
    updatedAt
    title
    text
    url
    userId
    user {
      name
    }
    upvotes
    sats
    boost
    ncomments
  }`

async function _indexItem (item) {
  console.log('indexing item', item.id)
  try {
    await search.index({
      id: item.id,
      index: 'item',
      version: new Date(item.updatedAt).getTime(),
      versionType: 'external_gte',
      body: item
    })
  } catch (e) {
    // ignore version conflict ...
    if (e?.meta?.statusCode === 409) {
      console.log('version conflict ignoring', item.id)
      return
    }
    console.log(e)
    throw e
  }
  console.log('done indexing item', item.id)
}

function indexItem ({ apollo }) {
  return async function ({ data: { id } }) {
    // 1. grab item from database
    // could use apollo to avoid duping logic
    // when grabbing sats and user name, etc
    const { data: { item } } = await apollo.query({
      query: gql`
        ${ITEM_SEARCH_FIELDS}
        query Item {
          item(id: ${id}) {
            ...ItemSearchFields
          }
        }`
    })

    // 2. index it with external version based on updatedAt
    await _indexItem(item)
  }
}

function indexAllItems ({ apollo }) {
  return async function () {
    // cursor over all items in the Item table
    let items = []; let cursor = null
    do {
      // query for items
      ({ data: { allItems: { items, cursor } } } = await apollo.query({
        query: gql`
          ${ITEM_SEARCH_FIELDS}
          query AllItems($cursor: String) {
            allItems(cursor: $cursor) {
              items {
                ...ItemSearchFields
              }
              cursor
            }
          }`,
        variables: { cursor }
      }))

      // for all items, index them
      try {
        items.forEach(_indexItem)
      } catch (e) {
        // ignore errors
        console.log(e)
      }
    } while (cursor)
  }
}

module.exports = { indexItem, indexAllItems }
