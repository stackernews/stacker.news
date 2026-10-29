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
