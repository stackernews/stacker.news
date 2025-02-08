import { gql } from '@apollo/client'
import { COMMENTS } from './comments'

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

export const ITEM_FIELDS = gql`
  ${STREAK_FIELDS}
  fragment ItemFields on Item {
    id
    parentId
    createdAt
    invoicePaidAt
    deletedAt
    title
    url
    user {
      id
      name
      meMute
      ...StreakFields
    }
    sub {
      name
      userId
      moderated
      meMuteSub
      meSubscription
      nsfw
      replyCost
    }
    otsHash
    position
    sats
    credits
    meAnonSats @client
    boost
    bounty
    bountyPaidTo
    noteId
    path
    upvotes
    meSats
    meCredits
    meDontLikeSats
    meBookmark
    meSubscription
    meForward
    outlawed
    freebie
    bio
    ncomments
    nDirectComments
    commentSats
    commentCredits
    lastCommentAt
    isJob
    status
    company
    location
    remote
    subName
    pollCost
    pollExpiresAt
    uploadId
    mine
    imgproxyUrls
    rel
    apiKey
    invoice {
      id
      actionState
      confirmedAt
    }
    cost
  }`

export const ITEM_FULL_FIELDS = gql`
  ${ITEM_FIELDS}
  ${STREAK_FIELDS}
  fragment ItemFullFields on Item {
    ...ItemFields
    text
    root {
      id
      title
      bounty
      bountyPaidTo
      subName
      mine
      ncomments
      user {
        id
        name
        ...StreakFields
      }
      sub {
        name
        userId
        moderated
        meMuteSub
        meSubscription
      }
    }
    forwards {
      userId
      pct
      user {
        name
      }
    }
  }`

export const ITEM_OTS_FIELDS = gql`
  fragment ItemOtsFields on Item {
    id
    title
    text
    url
    parentOtsHash
    otsHash
    deletedAt
  }`

export const ITEM_OTS = gql`
  ${ITEM_OTS_FIELDS}

  query Item($id: ID!) {
    item(id: $id) {
      ...ItemOtsFields
    }
  }`

export const POLL_FIELDS = gql`
  fragment PollFields on Item {
    poll {
      meVoted
      meInvoiceId
      meInvoiceActionState
      count
      options {
        id
        option
        count
      }
    }
  }`

export const ITEM = gql`
  ${ITEM_FULL_FIELDS}
  ${POLL_FIELDS}

  query Item($id: ID!) {
    item(id: $id) {
      ...ItemFullFields
      ...PollFields
    }
  }`

export const ITEM_FULL = gql`
  ${ITEM_FULL_FIELDS}
  ${POLL_FIELDS}
  ${COMMENTS}
  query Item($id: ID!, $sort: String, $cursor: String) {
    item(id: $id) {
      ...ItemFullFields
      prior
      ...PollFields
      comments(sort: $sort, cursor: $cursor) {
        cursor
        comments {
          ...CommentsRecursive
        }
      }
    }
  }`

export const RELATED_ITEMS = gql`
  ${ITEM_FIELDS}
  query Related($title: String, $id: ID, $cursor: String, $limit: Limit) {
    related(title: $title, id: $id, cursor: $cursor, limit: $limit) {
      cursor
      items {
        ...ItemFields
      }
    }
  }
`

export const RELATED_ITEMS_WITH_ITEM = gql`
  ${ITEM_FIELDS}
  query Related($title: String, $id: ID!, $cursor: String, $limit: Limit) {
    item(id: $id) {
      ...ItemFields
    }
    related(title: $title, id: $id, cursor: $cursor, limit: $limit) {
      cursor
      items {
        ...ItemFields
      }
    }
  }
`
