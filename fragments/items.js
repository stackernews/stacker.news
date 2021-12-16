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
    boost
    tips
    meVote
    meSats
    meTip
    ncomments
    mine
    root {
      id
      title
      user {
        name
        id
      }
    }
  }`

export const MORE_ITEMS = gql`
  ${ITEM_FIELDS}

  query MoreItems($sort: String!, $cursor: String, $name: String, $within: String) {
    moreItems(sort: $sort, cursor: $cursor, name: $name, within: $within) {
      cursor
      items {
        ...ItemFields
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

export const ITEM_FULL = gql`
  ${ITEM_FIELDS}
  ${COMMENTS}
  query Item($id: ID!) {
    item(id: $id) {
      ...ItemFields
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
