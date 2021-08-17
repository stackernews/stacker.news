import { gql } from '@apollo/client'
import { ITEM_FIELDS } from './items'

export const NOTIFICATIONS = gql`
  ${ITEM_FIELDS}

  query Notifications($cursor: String) {
    notifications(cursor: $cursor) {
      cursor
      notifications {
        __typename
        ... on Votification {
          earnedSats
          item {
            ...ItemFields
            text
          }
        }
        ... on Reply {
          item {
            ...ItemFields
            text
          }
        }
      }
    }
  } `
