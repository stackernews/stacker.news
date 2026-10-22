import { gql } from '@apollo/client'

// the include flags pick stackers, territories or both.
// for '' subSuggestions returns the first territories by name
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
