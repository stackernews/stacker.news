import { gql } from '@apollo/client'
import { ITEM_FIELDS, ITEM_FULL_FIELDS } from './items'
import { COMMENTS_ITEM_EXT_FIELDS } from './comments'

export const SUB_FIELDS = gql`
  fragment SubFields on Sub {
    name
    createdAt
    postTypes
    allowFreebies
    rankingType
    billingType
    billingCost
    billingAutoRenew
    billedLastAt
    billPaidUntil
    baseCost
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

  fragment SubFullFields on Sub {
    ...SubFields
    user {
      name
      id
      optional {
        streak
      }
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

export const SUB_PAY = gql`
  ${SUB_FULL_FIELDS}
  mutation paySub($name: String!, $hash: String, $hmac: String) {
    paySub(name: $name, hash: $hash, hmac: $hmac) {
      ...SubFullFields
    }
  }`

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
