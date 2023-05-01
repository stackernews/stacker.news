import { gql } from '@apollo/client'
import { ITEM_FIELDS } from './items'
import { COMMENT_FIELDS } from './comments'

export const SUB_FIELDS = gql`
  fragment SubFields on Sub {
    name
    postTypes
    rankingType
    baseCost
  }`

export const SUB = gql`
  ${SUB_FIELDS}

  query Sub($sub: String!) {
    sub(name: $sub) {
      ...SubFields
    }
  }`

export const SUB_ITEMS = gql`
  ${SUB_FIELDS}
  ${ITEM_FIELDS}
  query SubItems($sub: String!, $sort: String, $type: String) {
    sub(name: $sub) {
      ...SubFields
    }
    items(sub: $sub, sort: $sort, type: $type) {
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
  query SubSearch($sub: String!, $q: String, $cursor: String) {
    sub(name: $sub) {
      ...SubFields
    }
    search(q: $q, cursor: $cursor) {
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

export const SUB_FLAT_COMMENTS = gql`
  ${SUB_FIELDS}
  ${COMMENT_FIELDS}

  query SubFlatComments($sub: String!, $sort: String!, $cursor: String) {
    sub(name: $sub) {
      ...SubFields
    }

    moreFlatComments(sub: $sub, sort: $sort, cursor: $cursor) {
      cursor
      comments {
        ...CommentFields
      }
    }
  }
`
