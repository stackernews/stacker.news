import { gql } from '@apollo/client'

export const ITEM_FIELDS = gql`
  fragment ItemFields on Item {
    id
    parentId
    createdAt
    title
    url
    user {
      name
    }
    sats
    boost
    meSats
    ncomments
  }`

export const MORE_ITEMS = gql`
  ${ITEM_FIELDS}

  query MoreItems($sort: String!, $cursor: String, $userId: ID) {
    moreItems(sort: $sort, cursor: $cursor, userId: $userId) {
      cursor
      items {
        ...ItemFields
      }
    }
  } `

export const ITEMS_FEED = gql`
  ${ITEM_FIELDS}

  {
    items {
      ...ItemFields
    }
  }`

export const ITEMS_RECENT = gql`
  ${ITEM_FIELDS}

  {
    items: recent {
      ...ItemFields
    }
  }`
