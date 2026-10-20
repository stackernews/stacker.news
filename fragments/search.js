import { gql } from '@apollo/client'

// the include flags skip empty lookups, subSuggestions returns every territory for ''
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
