import { gql } from '@apollo/client'
import { ITEM_FULL_FIELDS } from './items'
import { INVITE_FIELDS } from './invites'

export const HAS_NOTIFICATIONS = gql`{ hasNewNotes }`

export const NOTIFICATIONS = gql`
  ${ITEM_FULL_FIELDS}
  ${INVITE_FIELDS}

  query Notifications($cursor: String, $inc: String) {
    notifications(cursor: $cursor, inc: $inc) {
      cursor
      lastChecked
      notifications {
        __typename
        ... on Mention {
          id
          sortTime
          mention
          item {
            ...ItemFullFields
            text
          }
        }
        ... on Votification {
          id
          sortTime
          earnedSats
          item {
            ...ItemFullFields
            text
          }
        }
        ... on ForwardedVotification {
          id
          sortTime
          earnedSats
          item {
            ...ItemFullFields
            text
          }
        }
        ... on Streak {
          id
          sortTime
          days
        }
        ... on Earn {
          id
          sortTime
          minSortTime
          earnedSats
          sources {
            posts
            comments
            tipPosts
            tipComments
          }
        }
        ... on Referral {
          id
          sortTime
        }
        ... on Reply {
          id
          sortTime
          item {
            ...ItemFullFields
            text
          }
        }
        ... on FollowActivity {
          id
          sortTime
          item {
            ...ItemFullFields
            text
          }
        }
        ... on Invitification {
          id
          sortTime
          invite {
            ...InviteFields
          }
        }
        ... on JobChanged {
          id
          sortTime
          item {
            ...ItemFields
          }
        }
        ... on InvoicePaid {
          id
          sortTime
          earnedSats
          invoice {
            id
            nostr
            comment
            lud18Data
          }
        }
      }
    }
  } `
