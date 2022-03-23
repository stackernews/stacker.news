import { gql } from '@apollo/client'
import { ITEM_FIELDS } from './items'
import { INVITE_FIELDS } from './invites'

export const NOTIFICATIONS = gql`
  ${ITEM_FIELDS}
  ${INVITE_FIELDS}

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
        ... on Invitification {
          sortTime
          invite {
            ...InviteFields
          }
        }
        ... on JobChanged {
          sortTime
          item {
            ...ItemFields
          }
        }
        ... on Earn {
          sortTime
          earnedSats
        }
        ... on InvoicePaid {
          sortTime
          earnedSats
          invoice {
            id
          }
        }
      }
    }
  } `
