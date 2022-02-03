import { gql } from '@apollo/client'
import { COMMENT_FIELDS } from './comments'
import { ITEM_FIELDS, ITEM_WITH_COMMENTS } from './items'

export const ME = gql`
  {
    me {
      id
      name
      sats
      stacked
      freePosts
      freeComments
      hasNewNotes
      tipDefault
      bio {
        id
      }
      hasInvites
      upvotePopover
      tipPopover
    }
  }`

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

export const TOP_USERS = gql`
  query TopUsers($cursor: String, $within: String!, $userType: String!) {
    topUsers(cursor: $cursor, within: $within, userType: $userType) {
      users {
        name
        amount
      }
      cursor
    }
  }
`

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
    moreFlatComments(sort: "user", name: $name) {
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
