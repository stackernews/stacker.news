import { gql } from '@apollo/client'
import { ITEM_FIELDS } from './items'

export const NOTIFICATIONS = gql`
  ${ITEM_FIELDS}

  query Notifications($cursor: String) {
    notifications(cursor: $cursor) {
      cursor
      lastChecked
      notifications {
        __typename
        ... on Mention {
          sortTime
          mention
          item {
            ...ItemFields
            text
          }
        }
        ... on Votification {
          sortTime
          earnedSats
          item {
            ...ItemFields
            text
          }
        }
        ... on Reply {
          sortTime
          item {
            ...ItemFields
            text
          }
        }
      }
    }
  } `
