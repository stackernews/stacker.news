import { gql } from 'graphql-tag'
import search from '@/api/search/index.js'
import removeMd from 'remove-markdown'

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
    sub {
      name
    }
    root {
      subName
    }
    status
    company
    location
    remote
    upvotes
    sats
    boost
    lastCommentAt
    commentSats
    path
    ncomments
  }`

async function _indexItem (item, { models, updatedAt }) {
  console.log('indexing item', item.id)
  // HACK: modify the title for jobs so that company/location are searchable
  // and highlighted without further modification
  const itemcp = { ...item }
  if (item.company) {
    itemcp.title += ` \\ ${item.company}`
  }
  if (item.location || item.remote) {
    itemcp.title += ` \\ ${item.location || ''}${item.location && item.remote ? ' or ' : ''}${item.remote ? 'Remote' : ''}`
  }
  if (!item.sub?.name && item.root?.subName) {
    itemcp.sub = { name: item.root.subName }
  }
  if (item.text) {
    itemcp.text = removeMd(item.text)
  }

  const itemdb = await models.item.findUnique({
    where: { id: Number(item.id) },
    select: { weightedVotes: true, weightedDownVotes: true }
  })

  itemcp.wvotes = itemdb.weightedVotes - itemdb.weightedDownVotes

  const bookmarkedBy = await models.bookmark.findMany({
    where: { itemId: Number(item.id) },
    select: { userId: true, createdAt: true },
    orderBy: [
      {
        createdAt: 'desc'
      }
    ]
  })
  itemcp.bookmarkedBy = bookmarkedBy.map(bookmark => bookmark.userId)

  // use the latest of:
  // 1. an explicitly-supplied updatedAt value, used when a bookmark to this item was removed
  // 2. when the item itself was updated
  // 3. or when it was last bookmarked
  // to determine the latest version of the indexed version
  const latestUpdatedAt = Math.max(
    updatedAt ? new Date(updatedAt).getTime() : 0,
    new Date(item.updatedAt).getTime(),
    bookmarkedBy[0] ? new Date(bookmarkedBy[0].createdAt).getTime() : 0
  )

  try {
    await search.index({
      id: item.id,
      index: process.env.OPENSEARCH_INDEX,
      version: new Date(latestUpdatedAt).getTime(),
      versionType: 'external_gte',
      body: itemcp
    })
  } catch (e) {
    // ignore version conflict ...
    if (e?.meta?.statusCode === 409) {
      console.log('version conflict ignoring', item.id)
      return
    }
    throw e
  }
}

// `data.updatedAt` is an explicit updatedAt value for the use case of a bookmark being removed
// this is consulted to generate the index version
export async function indexItem ({ data: { id, updatedAt }, apollo, models }) {
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
  await _indexItem(item, { models, updatedAt })
}

export async function indexAllItems ({ apollo, models }) {
  // cursor over all items in the Item table
  let items = []; let cursor = null
  do {
    // query for items
    ({ data: { items: { items, cursor } } } = await apollo.query({
      query: gql`
          ${ITEM_SEARCH_FIELDS}
          query AllItems($cursor: String) {
            items(cursor: $cursor, sort: "recent", limit: 1000, type: "all") {
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
      items.forEach(i => _indexItem(i, { models }))
    } catch (e) {
      // ignore errors
    }
  } while (cursor)
}
