import { gql } from '@apollo/client'
import { ITEM_FULL_FIELDS, POLL_FIELDS } from './items'
import { INVITE_FIELDS } from './invites'
import { SUB_FIELDS } from './subs'
import { INVOICE_FIELDS } from './wallet'

export const HAS_NOTIFICATIONS = gql`{ hasNewNotes }`

export const INVOICIFICATION = gql`
  ${ITEM_FULL_FIELDS}
  ${POLL_FIELDS}
  ${INVOICE_FIELDS}
  fragment InvoicificationFields on Invoicification {
    id
    sortTime
    invoice {
      ...InvoiceFields
      item {
        ...ItemFullFields
        ...PollFields
      }
      itemAct {
        id
        act
        invoice {
          id
          actionState
        }
      }
    }
  }`

export const NOTIFICATIONS = gql`
  ${INVOICIFICATION}
  ${INVITE_FIELDS}
  ${SUB_FIELDS}

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
        ... on ItemMention {
          id
          sortTime
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
        ... on Revenue {
          id
          sortTime
          earnedSats
          subName
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
          type
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
        ... on ReferralReward {
          id
          sortTime
          earnedSats
          sources {
            forever
            oneDay
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
        ... on TerritoryPost {
          id
          sortTime
          item {
            ...ItemFullFields
            text
          }
        }
        ... on TerritoryTransfer {
          id
          sortTime
          sub {
            ...SubFields
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
        ... on SubStatus {
          id
          sortTime
          sub {
            ...SubFields
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
        ... on Invoicification {
          ...InvoicificationFields
        }
        ... on WithdrawlPaid {
          id
          sortTime
          earnedSats
          withdrawl {
            autoWithdraw
            p2p
            satsFeePaid
          }
        }
        ... on Reminder {
          id
          sortTime
          item {
            ...ItemFullFields
          }
        }
      }
    }
  } `
