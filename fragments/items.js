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
    sats
    upvotes
    boost
    meSats
    ncomments
    maxBid
    sub {
      name
      baseCost
    }
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
      },
      pins {
        ...ItemFields
        position
      }
    }
  }`

export const ITEM = gql`
  ${ITEM_FIELDS}

  query Item($id: ID!) {
    item(id: $id) {
      ...ItemFields
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
  ${COMMENTS}
  query Item($id: ID!) {
    item(id: $id) {
      ...ItemFields
      prior
      position
      text
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
  query Search($q: String!, $cursor: String) {
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
