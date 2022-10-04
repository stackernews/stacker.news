import { gql } from '@apollo/client'
import { ITEM_FIELDS } from './items'

export const SUB_FIELDS = gql`
  fragment SubFields on Sub {
    name
    postTypes
    rankingType
    baseCost
  }`

export const SUB = gql`
  ${SUB_FIELDS}

  query Sub($sub: ID!) {
    sub(name: $sub) {
      ...SubFields
    }
  }`

export const SUB_ITEMS = gql`
  ${SUB_FIELDS}
  ${ITEM_FIELDS}
  query SubRecent($sub: String, $sort: String) {
    sub(name: $sub) {
      ...SubFields
    }
    items(sub: $sub, sort: $sort) {
      cursor
      items {
        ...ItemFields
        position
      },
      pins {
        ...ItemFields
        position
      }
    }
  }
`

export const SUB_SEARCH = gql`
  ${SUB_FIELDS}
  ${ITEM_FIELDS}
  query SubSearch($sub: String, $q: String, $cursor: String) {
    sub(name: $sub) {
      ...SubFields
    }
    search(q: $q, sub: $sub, cursor: $cursor) {
      cursor
      items {
        ...ItemFields
        text
        searchTitle
        searchText
      }
    }
  }
`
