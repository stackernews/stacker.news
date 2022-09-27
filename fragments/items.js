import { gql } from '@apollo/client'
import { COMMENTS } from './comments'

export const ITEM_FIELDS = gql`
  fragment ItemFields on Item {
    id
    parentId
    createdAt
    title
    url
    user {
      name
      id
    }
    fwdUser {
      name
      id
    }
    sats
    upvotes
    boost
    path
    meSats
    meDontLike
    outlawed
    freebie
    ncomments
    commentSats
    lastCommentAt
    maxBid
    company
    location
    remote
    sub {
      name
      baseCost
    }
    pollCost
    status
    uploadId
    mine
    root {
      id
      title
      sub {
        name
      }
      user {
        name
        id
      }
    }
  }`

export const ITEMS = gql`
  ${ITEM_FIELDS}

  query items($sub: String, $sort: String, $cursor: String, $name: String, $within: String) {
    items(sub: $sub, sort: $sort, cursor: $cursor, name: $name, within: $within) {
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
  }`

export const OUTLAWED_ITEMS = gql`
  ${ITEM_FIELDS}

  query outlawedItems($cursor: String) {
    outlawedItems(cursor: $cursor) {
      cursor
      items {
        ...ItemFields
        text
      }
    }
  }`

export const BORDERLAND_ITEMS = gql`
  ${ITEM_FIELDS}

  query borderlandItems($cursor: String) {
    borderlandItems(cursor: $cursor) {
      cursor
      items {
        ...ItemFields
        text
      }
    }
  }`

export const FREEBIE_ITEMS = gql`
  ${ITEM_FIELDS}

  query freebieItems($cursor: String) {
    freebieItems(cursor: $cursor) {
      cursor
      items {
        ...ItemFields
        text
      }
    }
  }`

export const POLL_FIELDS = gql`
  fragment PollFields on Item {
    poll {
      meVoted
      count
      options {
        id
        option
        count
        meVoted
      }
    }
  }`

export const ITEM = gql`
  ${ITEM_FIELDS}
  ${POLL_FIELDS}

  query Item($id: ID!) {
    item(id: $id) {
      ...ItemFields
      ...PollFields
      text
    }
  }`

export const COMMENTS_QUERY = gql`
  ${COMMENTS}

  query Comments($id: ID!, $sort: String) {
    comments(id: $id, sort: $sort) {
      ...CommentsRecursive
    }
  }
`

export const ITEM_FULL = gql`
  ${ITEM_FIELDS}
  ${POLL_FIELDS}
  ${COMMENTS}
  query Item($id: ID!) {
    item(id: $id) {
      ...ItemFields
      prior
      position
      text
      ...PollFields
      comments {
        ...CommentsRecursive
      }
    }
  }`

export const ITEM_WITH_COMMENTS = gql`
  ${ITEM_FIELDS}
  ${COMMENTS}
  fragment ItemWithComments on Item {
      ...ItemFields
      text
      comments {
        ...CommentsRecursive
      }
    }`

export const ITEM_SEARCH = gql`
  ${ITEM_FIELDS}
  query Search($q: String, $cursor: String) {
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
