import { gql } from '@apollo/client'
import { COMMENT_FIELDS } from './comments'
import { ITEM_FIELDS, ITEM_WITH_COMMENTS } from './items'

export const USER_FIELDS = gql`
  ${ITEM_FIELDS}
  fragment UserFields on User {
    id
    createdAt
    name
    nitems
    ncomments
    stacked
    sats
    bio {
      ...ItemFields
      text
    }
  }`

export const USER_FULL = gql`
  ${USER_FIELDS}
  ${ITEM_WITH_COMMENTS}
  query User($name: String!) {
    user(name: $name) {
      ...UserFields
      bio {
        ...ItemWithComments
      }
  }
}`

export const USER_WITH_COMMENTS = gql`
  ${USER_FIELDS}
  ${ITEM_WITH_COMMENTS}
  ${COMMENT_FIELDS}
  query UserWithComments($name: String!) {
    user(name: $name) {
      ...UserFields
      bio {
        ...ItemWithComments
      }
    }
    moreFlatComments(name: $name) {
      cursor
      comments {
        ...CommentFields
      }
    }
  }`

export const USER_WITH_POSTS = gql`
  ${USER_FIELDS}
  ${ITEM_WITH_COMMENTS}
  ${ITEM_FIELDS}
  query UserWithPosts($name: String!, $sort: String!) {
    user(name: $name) {
      ...UserFields
      bio {
        ...ItemWithComments
      }
    }
    moreItems(sort: $sort, name: $name) {
      cursor
      items {
        ...ItemFields
      }
    }
  }`
