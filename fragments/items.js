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
    ncomments
  }`

export const ITEMS_FEED = gql`
  ${ITEM_FIELDS}

  {
    items {
      ...ItemFields
    }
  }`
