import { gql } from '@apollo/client'
import { ITEM_FIELDS, ITEM_FULL_FIELDS } from './items'
import { COMMENTS_ITEM_EXT_FIELDS } from './comments'

export const SUB_FIELDS = gql`
  fragment SubFields on Sub {
    name
    postTypes
    rankingType
    baseCost
  }`

export const SUB = gql`
  ${SUB_FIELDS}

  query Sub($sub: String) {
    sub(name: $sub) {
      ...SubFields
    }
  }`

export const SUB_ITEMS = gql`
  ${SUB_FIELDS}
  ${ITEM_FIELDS}
  ${COMMENTS_ITEM_EXT_FIELDS}

  query SubItems($sub: String, $sort: String, $cursor: String, $type: String, $name: String, $when: String, $by: String, $limit: Int, $includeComments: Boolean = false) {
    sub(name: $sub) {
      ...SubFields
    }

    items(sub: $sub, sort: $sort, cursor: $cursor, type: $type, name: $name, when: $when, by: $by, limit: $limit) {
      cursor
      items {
        ...ItemFields
        ...CommentItemExtFields @include(if: $includeComments)
        position
      },
      pins {
        ...ItemFields
        ...CommentItemExtFields @include(if: $includeComments)
        position
      }
    }
  }
`

export const SUB_SEARCH = gql`
  ${SUB_FIELDS}
  ${ITEM_FULL_FIELDS}
  query SubSearch($sub: String, $q: String, $cursor: String, $sort: String, $what: String, $when: String) {
    sub(name: $sub) {
      ...SubFields
    }
    search(sub: $sub, q: $q, cursor: $cursor, sort: $sort, what: $what, when: $when) {
      cursor
      items {
        ...ItemFullFields
        searchTitle
        searchText
      }
    }
  }
`
