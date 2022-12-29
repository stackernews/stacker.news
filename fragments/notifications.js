import { gql } from '@apollo/client'
import { ITEM_FIELDS } from './items'
import { INVITE_FIELDS } from './invites'

export const NOTIFICATIONS = gql`
  ${ITEM_FIELDS}
  ${INVITE_FIELDS}

  query Notifications($cursor: String, $inc: String) {
    notifications(cursor: $cursor, inc: $inc) {
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
        ... on Earn {
          sortTime
          earnedSats
          sources {
            posts
            comments
            tips
          }
        }
        ... on Referral {
          sortTime
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
