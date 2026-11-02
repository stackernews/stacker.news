import { gql } from '@apollo/client'

export const NAV_SEARCH_NAMES = gql`
  query navSearchNames($q: String!, $withUsers: Boolean!, $withSubs: Boolean!, $limit: Limit) {
    searchUsers(q: $q, limit: $limit) @include(if: $withUsers) {
      name
      photoId
      optional {
        stacked
      }
    }
    subSuggestions(q: $q, limit: $limit) @include(if: $withSubs) {
      name
    }
  }
`

const QUICK_SEARCH_HIT_FIELDS = gql`
  fragment QuickSearchHitFields on QuickSearchHit {
    itemId
    text
    userName
    sats
    ncomments
    createdAt
    subNames
  }
`

export const NAV_SEARCH_ITEMS = gql`
  ${QUICK_SEARCH_HIT_FIELDS}

  query navSearchItems($q: String!) {
    quickSearch(q: $q) {
      posts {
        ...QuickSearchHitFields
      }
      comments {
        ...QuickSearchHitFields
      }
    }
  }
`
