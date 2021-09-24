import { gql } from '@apollo/client'
import { ITEM_FIELDS } from './items'

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
