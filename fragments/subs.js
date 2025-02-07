import { gql } from '@apollo/client'
import { ITEM_FIELDS, ITEM_FULL_FIELDS } from './items'
import { COMMENTS_ITEM_EXT_FIELDS } from './comments'

// we can't import from users because of circular dependency
const STREAK_FIELDS = gql`
  fragment StreakFields on User {
    optional {
    streak
    gunStreak
      horseStreak
    }
  }
`

export const SUB_FIELDS = gql`
  fragment SubFields on Sub {
    name
    createdAt
    postTypes
    rankingType
    billingType
    billingCost
    billingAutoRenew
    billedLastAt
    billPaidUntil
    baseCost
    replyCost
    userId
    desc
    status
    moderated
    moderatedCount
    meMuteSub
    meSubscription
    nsfw
  }`

export const SUB_FULL_FIELDS = gql`
  ${SUB_FIELDS}
  ${STREAK_FIELDS}
  fragment SubFullFields on Sub {
    ...SubFields
    user {
      name
      id
      ...StreakFields
    }
  }`

export const SUB = gql`
  ${SUB_FIELDS}

  query Sub($sub: String) {
    sub(name: $sub) {
      ...SubFields
    }
  }`

export const SUB_FULL = gql`
  ${SUB_FULL_FIELDS}

  query Sub($sub: String) {
    sub(name: $sub) {
      ...SubFullFields
    }
  }`

export const SUBS = gql`
  ${SUB_FIELDS}

  query Subs {
    subs {
      ...SubFields
    }
  }`

export const SUB_ITEMS = gql`
  ${SUB_FULL_FIELDS}
  ${ITEM_FIELDS}
  ${COMMENTS_ITEM_EXT_FIELDS}

  query SubItems($sub: String, $sort: String, $cursor: String, $type: String, $name: String, $when: String, $from: String, $to: String, $by: String, $limit: Limit, $includeComments: Boolean = false) {
    sub(name: $sub) {
      ...SubFullFields
    }

    items(sub: $sub, sort: $sort, cursor: $cursor, type: $type, name: $name, when: $when, from: $from, to: $to, by: $by, limit: $limit) {
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
      ad {
        ...ItemFields
      }
    }
  }
`

export const SUB_SEARCH = gql`
  ${SUB_FIELDS}
  ${ITEM_FULL_FIELDS}
  query SubSearch($sub: String, $q: String, $cursor: String, $sort: String, $what: String, $when: String, $from: String, $to: String) {
    sub(name: $sub) {
      ...SubFields
    }
    search(sub: $sub, q: $q, cursor: $cursor, sort: $sort, what: $what, when: $when, from: $from, to: $to) {
      cursor
      items {
        ...ItemFullFields
        searchTitle
        searchText
      }
    }
  }
`

export const TOP_SUBS = gql`
  ${SUB_FULL_FIELDS}
  query TopSubs($cursor: String, $when: String, $from: String, $to: String, $by: String, ) {
    topSubs(cursor: $cursor, when: $when, from: $from, to: $to, by: $by) {
      subs {
        ...SubFullFields
        ncomments(when: $when, from: $from, to: $to)
        nposts(when: $when, from: $from, to: $to)

        optional {
          stacked(when: $when, from: $from, to: $to)
          spent(when: $when, from: $from, to: $to)
          revenue(when: $when, from: $from, to: $to)
        }
      }
      cursor
    }
  }
`
