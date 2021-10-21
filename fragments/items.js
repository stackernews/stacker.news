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
    meBoost
    meTip
    ncomments
    root {
      id
      title
    }
  }`

export const MORE_ITEMS = gql`
  ${ITEM_FIELDS}

  query MoreItems($sort: String!, $cursor: String, $userId: ID, $within: String) {
    moreItems(sort: $sort, cursor: $cursor, userId: $userId, within: $within) {
      cursor
      items {
        ...ItemFields
      }
    }
  } `

export const ITEM_FULL = id => gql`
  ${ITEM_FIELDS}
  ${COMMENTS}
  {
    item(id: ${id}) {
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
