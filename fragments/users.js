import { gql } from '@apollo/client'
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

export const USER_FULL = name => gql`
  ${USER_FIELDS}
  ${ITEM_WITH_COMMENTS}
  {
    user(name: "${name}") {
      ...UserFields
      bio {
        ...ItemWithComments
      }
  }
}`
